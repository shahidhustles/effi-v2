from __future__ import annotations

import json
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "content" / "effi-municipal-operations-manual-demo-v1.json"
OUTPUT = ROOT / "public" / "manuals" / "effi-municipal-operations-manual-demo-v1.pdf"


def load_manual() -> dict:
    with SOURCE.open("r", encoding="utf-8") as stream:
        return json.load(stream)


def draw_page(canvas, doc) -> None:
    page = doc.page
    width, height = A4
    canvas.saveState()
    canvas.setFillColor(colors.HexColor("#17354D"))
    canvas.rect(0, height - 18 * mm, width, 18 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawString(18 * mm, height - 11.5 * mm, "EFFI  /  MUNICIPAL OPERATIONS")
    canvas.setFillColor(colors.HexColor("#607486"))
    canvas.setFont("Helvetica", 8)
    canvas.drawString(18 * mm, 11 * mm, "Demo edition  |  Not a binding municipal policy")
    canvas.drawRightString(width - 18 * mm, 11 * mm, f"PAGE {page} OF 6")
    canvas.restoreState()


def build_story(manual: dict) -> list:
    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "PageTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        textColor=colors.HexColor("#132A3A"),
        spaceAfter=5 * mm,
        alignment=TA_LEFT,
    )
    kicker = ParagraphStyle(
        "Kicker",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#B15E32"),
        spaceAfter=2.5 * mm,
    )
    summary = ParagraphStyle(
        "Summary",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#455B6A"),
        borderColor=colors.HexColor("#D9E1E5"),
        borderWidth=0.7,
        borderPadding=8,
        backColor=colors.HexColor("#F3F6F7"),
        spaceAfter=6 * mm,
    )
    heading = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        textColor=colors.HexColor("#17354D"),
        spaceBefore=2 * mm,
        spaceAfter=2 * mm,
    )
    body = ParagraphStyle(
        "Body",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9.2,
        leading=13,
        textColor=colors.HexColor("#243844"),
        spaceAfter=2.5 * mm,
    )
    bullet = ParagraphStyle(
        "Bullet",
        parent=body,
        leftIndent=5 * mm,
        firstLineIndent=-3 * mm,
        bulletIndent=0,
        spaceAfter=2 * mm,
    )

    story: list = []
    for index, page in enumerate(manual["pages"]):
        if index:
            from reportlab.platypus import PageBreak

            story.append(PageBreak())
        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph(f"{page['category'].upper()}  /  {manual['version']}", kicker))
        story.append(Paragraph(page["heading"], title))
        story.append(Paragraph(page["summary"], summary))
        for section in page["sections"]:
            story.append(Paragraph(section["title"], heading))
            for paragraph in section.get("paragraphs", []):
                story.append(Paragraph(paragraph, body))
            for item in section.get("bullets", []):
                story.append(Paragraph(item, bullet, bulletText="•"))
        if index == 0:
            story.append(Spacer(1, 2 * mm))
            story.append(Paragraph(f"<b>Effective:</b> {manual['effectiveDate']}<br/><b>Notice:</b> {manual['disclaimer']}", summary))
    return story


def main() -> None:
    manual = load_manual()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    width, height = A4
    frame = Frame(18 * mm, 19 * mm, width - 36 * mm, height - 43 * mm, id="content")
    document = BaseDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=24 * mm,
        bottomMargin=19 * mm,
        title=manual["title"],
        author="Effi",
        subject=manual["subtitle"],
    )
    document.addPageTemplates([PageTemplate(id="manual", frames=[frame], onPage=draw_page)])
    document.build(build_story(manual))
    print(OUTPUT)


if __name__ == "__main__":
    main()
