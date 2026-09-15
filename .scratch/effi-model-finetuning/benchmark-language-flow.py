"""Evaluate the Effi tool flow across Indian languages against a served model.

Usage (OpenAI-compatible chat endpoint, e.g. the fine-tuned vLLM adapter):
  set -a; source apps/bot-gateway/.env.local; set +a
  python3 .scratch/effi-model-finetuning/benchmark-language-flow.py \
    --model effi-qwen3-vl-4b \
    --languages ta,te,bn,mr,gu,kn,ml,pa,hi,en

Usage (OpenCode Zen Responses API, e.g. Muse Spark):
  set -a; source apps/officer-dashboard/.env.local; set +a
  python3 .scratch/effi-model-finetuning/benchmark-language-flow.py \
    --api responses --model muse-spark-1.3-contributor-free \
    --languages ta,te,bn,mr,gu,kn,ml,pa,hi,en

For each language this replays the satisfactory-photo trajectory that the
gateway uses: assess_staged_image, then record_report_interpretation, then
ask_question. It reports, per language:

- the tool chain the model actually produced (TEXT means the model skipped
  the tool and wrote a citizen-facing sentence instead, which stalls reports),
- whether the recorded issue is English,
- whether the confirmation prompt uses the citizen's script.
"""

import argparse
import base64
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent

CONTEXT = "\n".join([
    "Training fixture state, all identifiers are synthetic.",
    "issue_known=true",
    "exact_location_pin_available=true",
    "accepted_attachment_ids=none",
    "interpretation_recorded=false",
    "explicitly_confirmed=false",
    "source_message_ids=msg_en_1",
    "staged_attachment_ids=att_en_1",
    "confirmed_interpretation_issue=none",
    "confirmed_interpretation_category=none",
    "Never invent a source identifier or numeric coordinate.",
])

MESSAGES = {
    "ta": "என் சாலையில் பெரிய குழி உள்ளது. புகைப்படத்தை அனுப்பிவிட்டேன்.",
    "te": "నా రోడ్డుపై పెద్ద గుంత ఉంది. ఫోటో పంపాను.",
    "bn": "আমার রাস্তায় বড় গর্ত আছে। ছবি পাঠিয়েছি।",
    "mr": "माझ्या रस्त्यावर मोठा खड्डा आहे. फोटो पाठवला आहे.",
    "gu": "મારા રસ્તા પર મોટો ખાડો છે. ફોટો મોકલ્યો છે.",
    "kn": "ನನ್ನ ರಸ್ತೆಯಲ್ಲಿ ದೊಡ್ಡ ಗುಂಡಿ ಇದೆ. ಫೋಟೋ ಕಳುಹಿಸಿದ್ದೇನೆ.",
    "ml": "എന്റെ റോഡിൽ വലിയ കുഴി ഉണ്ട്. ഫോട്ടോ അയച്ചു.",
    "pa": "ਮੇਰੀ ਸੜਕ 'ਤੇ ਵੱਡਾ ਟੋਆ ਹੈ। ਫੋਟੋ ਭੇਜੀ ਹੈ।",
    "hi": "मेरे रास्ते पर बड़ा गड्ढा है। फोटो भेज दी है।",
    "en": "There is a pothole on my main road. I have sent the photo and the exact pin.",
    "hinglish": "Mere road par bada gaddha hai. Photo bhej di hai.",
}

SCRIPTS = {
    "ta": r"[\u0B80-\u0BFF]",
    "te": r"[\u0C00-\u0C7F]",
    "bn": r"[\u0980-\u09FF]",
    "gu": r"[\u0A80-\u0AFF]",
    "kn": r"[\u0C80-\u0CFF]",
    "pa": r"[\u0A00-\u0A7F]",
    "ml": r"[\u0D00-\u0D7F]",
    "ur": r"[\u0600-\u06FF]",
    "devanagari": r"[\u0900-\u097F]",
}

OPENCODE_HEADERS = {
    "user-agent": "opencode/1.0 ai-sdk",
    "x-opencode-client": "cli",
    "x-opencode-project": "global",
}


class PostRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        new = super().redirect_request(request, fp, code, msg, headers, newurl)
        if new is not None and request.data is not None:
            new.method = "POST"
            new.data = request.data
            new.add_header("Content-Type", "application/json")
        return new


def load_row():
    rows = {}
    for line in (ROOT / "dataset/effi-training.jsonl").read_text(encoding="utf-8").splitlines():
        row = json.loads(line)
        rows[row["id"]] = row
    return rows["satisfactory_photo_en_1"]


def script_report(text):
    found = [name for name, pattern in SCRIPTS.items() if re.search(pattern, text)]
    if re.search(r"[A-Za-z]", text):
        found.append("latin")
    return found


def data_url(image):
    path = Path(image)
    if not path.is_absolute():
        path = ROOT / path
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def chat_content(message, image):
    if not image:
        return message
    return [
        {"type": "text", "text": message},
        {"type": "image_url", "image_url": {"url": data_url(image)}},
    ]


def responses_user_item(message, image):
    content = [{"type": "input_text", "text": message}]
    if image:
        content.append({"type": "input_image", "image_url": data_url(image)})
    return {"role": "user", "content": content}


def responses_tools(tools):
    converted = []
    for tool in tools:
        function = tool.get("function", tool)
        converted.append({
            "type": "function",
            "name": function["name"],
            "description": function.get("description", ""),
            "parameters": function.get("parameters", {"type": "object", "properties": {}}),
        })
    return converted


def tool_result(name, arguments, issue, ask):
    if name == "assess_staged_image":
        result = f"Staged image {arguments.get('attachmentId')} assessed as {arguments.get('assessment')}."
    elif name == "record_report_interpretation":
        issue = str(arguments.get("issue", ""))
        result = "The interpretation is recorded with an exact location and one accepted photo."
    elif name == "ask_question":
        ask = str(arguments.get("prompt", ""))
        result = "Question asked."
    else:
        result = f"Tool {name} completed."
    return result, issue, ask


def run_chat(post, model, tools, system, message, image, max_tokens):
    history = [
        {"role": "system", "content": system},
        {"role": "user", "content": chat_content(message, image)},
    ]
    chain, issue, ask, reply = [], "", "", ""
    for _ in range(4):
        body = post({"model": model, "messages": history, "tools": tools, "tool_choice": "auto", "temperature": 0, "max_tokens": max_tokens})
        choice = body["choices"][0]["message"]
        calls = choice.get("tool_calls") or []
        if not calls:
            chain.append("TEXT")
            reply = str(choice.get("content") or "").strip()
            break
        name = calls[0]["function"]["name"]
        arguments = json.loads(calls[0]["function"]["arguments"])
        chain.append(name)
        history.append({"role": "assistant", "content": "", "tool_calls": calls})
        result, issue, ask = tool_result(name, arguments, issue, ask)
        history.append({"role": "tool", "tool_call_id": calls[0]["id"], "name": name, "content": result})
        if name == "ask_question":
            break
    return chain, issue, ask, reply


def run_responses(post, model, tools, system, message, image, max_tokens, reasoning_effort):
    items = [responses_user_item(message, image)]
    chain, issue, ask, reply = [], "", "", ""
    for _ in range(4):
        body = {
            "model": model,
            "instructions": system,
            "input": items,
            "tools": responses_tools(tools),
            "tool_choice": "auto",
            "max_output_tokens": max_tokens,
        }
        if reasoning_effort:
            body["reasoning"] = {"effort": reasoning_effort}
        response = post(body)
        output = response.get("output") or []
        calls = [item for item in output if item.get("type") == "function_call"]
        texts = [
            part.get("text", "")
            for item in output
            if item.get("type") == "message"
            for part in item.get("content", [])
            if part.get("type") == "output_text"
        ]
        if not calls:
            chain.append("TEXT")
            reply = "\n".join(texts).strip()
            break
        items.extend(item for item in output if item.get("type") != "reasoning")
        asked = False
        for call in calls:
            name = str(call.get("name") or "")
            arguments = json.loads(call.get("arguments") or "{}")
            chain.append(name)
            result, issue, ask = tool_result(name, arguments, issue, ask)
            items.append({"type": "function_call_output", "call_id": call.get("call_id"), "output": result})
            if name == "ask_question":
                asked = True
        if asked:
            break
    return chain, issue, ask, reply


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", choices=["chat", "responses"], default="chat")
    parser.add_argument("--model", default=None)
    parser.add_argument("--base-url", default=None)
    parser.add_argument("--session", default="ses_effi_language_flow")
    parser.add_argument("--languages", default="ta,te,bn,mr,gu,kn,ml,pa,hi,en,hinglish")
    parser.add_argument("--image", default=None, help="Fixture image path relative to this directory, e.g. images/pothole-1.png")
    parser.add_argument("--reasoning-effort", default="low", help="Responses API reasoning effort; empty string omits it")
    parser.add_argument("--max-tokens", type=int, default=260)
    args = parser.parse_args()

    if args.api == "chat":
        base_url = (args.base_url or os.environ.get("EFFI_MODEL_BASE_URL") or "").rstrip("/")
        api_key = os.environ.get("EFFI_MODEL_API_KEY")
        model = args.model or "effi-qwen3-vl-4b"
    else:
        base_url = (args.base_url or os.environ.get("OPENCODE_BASE_URL") or "https://opencode.ai/zen/v1").rstrip("/")
        api_key = os.environ.get("OPENCODE_API_KEY")
        model = args.model or "muse-spark-1.3-contributor-free"
    if not base_url or not api_key:
        raise SystemExit("Set the base URL and API key for the selected API.")

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    if args.api == "responses":
        headers.update(OPENCODE_HEADERS)
        headers["x-opencode-session"] = args.session
        headers["x-opencode-request"] = f"{args.session}_req"
    opener = urllib.request.build_opener(PostRedirect)

    def post(body):
        request = urllib.request.Request(
            base_url + "/responses" if args.api == "responses" else base_url + "/chat/completions",
            data=json.dumps(body).encode("utf-8"),
            headers=headers,
        )
        try:
            with opener.open(request, timeout=900) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            print("HTTP", error.code, error.read().decode("utf-8")[:300])
            raise

    warm = {"model": model, "input": "ping", "max_output_tokens": 32}
    if args.api == "chat":
        warm = {"model": model, "messages": [{"role": "user", "content": "ping"}], "max_tokens": 2}
    for attempt in range(1, 40):
        try:
            post(warm)
            break
        except Exception:
            if attempt == 39:
                raise
            time.sleep(10)

    row = load_row()
    instructions = (REPO / "apps/bot-gateway/agent/instructions.md").read_text(encoding="utf-8").strip()
    system = f"{instructions}\n\n{CONTEXT}"

    for language in args.languages.split(","):
        message = MESSAGES.get(language)
        if message is None:
            print(f"{language}: no sample message, skipped")
            continue
        try:
            if args.api == "chat":
                chain, issue, ask, reply = run_chat(post, model, row["tools"], system, message, args.image, args.max_tokens)
            else:
                chain, issue, ask, reply = run_responses(post, model, row["tools"], system, message, args.image, args.max_tokens, args.reasoning_effort)
        except Exception as error:
            print(f"{language}: ERROR {type(error).__name__}: {error}")
            continue
        print(f"{language}: {' -> '.join(chain)}")
        if reply:
            print(f"    reply scripts={script_report(reply)} text={reply[:160]!r}")
        print(f"    issue scripts={script_report(issue)} text={issue[:90]!r}")
        print(f"    ask   scripts={script_report(ask)} text={ask[:90]!r}")


if __name__ == "__main__":
    main()
