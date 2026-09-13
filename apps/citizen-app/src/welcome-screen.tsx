import { Image } from "expo-image";
import { ArrowRight, BrainCircuit, CircleCheckBig, ShieldCheck } from "lucide-react-native";
import type { ComponentType } from "react";
import { ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import type { LucideProps } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import civicSkyline from "@/assets/images/civic-skyline.png";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useColor } from "@/hooks/useColor";
import { withOpacity } from "@/theme/colors";

type WelcomeScreenProps = {
  onGetStarted: () => void;
  onSignIn: () => void;
};

type FeatureProps = {
  icon: ComponentType<LucideProps>;
  title: string;
  children: string;
  tone: string;
};

function Feature({ icon: Icon, title, children, tone }: FeatureProps) {
  const text = useColor("foreground");

  return (
    <View style={styles.featureRow}>
      <View style={[styles.featureIcon, { backgroundColor: withOpacity(tone, 0.08) }]}>
        <Icon color={tone} size={27} strokeWidth={2.2} />
      </View>
      <View style={styles.featureCopy}>
        <Text style={[styles.featureTitle, { color: text }]}>{title}</Text>
        <Text variant="caption" style={styles.featureBody}>
          {children}
        </Text>
      </View>
    </View>
  );
}

export function WelcomeScreen({ onGetStarted, onSignIn }: WelcomeScreenProps) {
  const { height, width } = useWindowDimensions();
  const background = useColor("background");
  const text = useColor("foreground");
  const blue = useColor("blue");
  const green = useColor("green");
  const brandForeground = useColor("brandForeground");

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: background }]} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={[styles.content, { minHeight: Math.max(height - 40, 760) }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.titleBlock}>
          <Text style={[styles.eyebrow, { color: blue }]}>WELCOME TO</Text>
          <Text accessibilityRole="header" style={[styles.wordmark, { color: text }]}>
            effi<Text style={[styles.wordmarkDot, { color: text }]}>·</Text>
            <Text style={[styles.wordmarkVersion, { color: blue }]}>v2</Text>
          </Text>
          <Text style={[styles.tagline, { color: text }]}>AI-Powered Civic Intelligence{"\n"}for Accountable Governance</Text>
        </View>

        <View style={styles.artworkFrame} importantForAccessibility="no-hide-descendants">
          <Image source={civicSkyline} style={styles.artwork} contentFit="contain" transition={180} />
        </View>

        <View style={styles.features}>
          <Feature icon={ShieldCheck} title="Report Issues" tone={blue}>
            Easily report civic issues with photos, video, audio & location.
          </Feature>
          <Feature icon={BrainCircuit} title="AI Intelligence" tone={blue}>
            Effi AI detects patterns and helps prioritize what matters.
          </Feature>
          <Feature icon={CircleCheckBig} title="Verified Resolution" tone={green}>
            Track actions and verify that issues are truly resolved.
          </Feature>
        </View>

        <View style={styles.actions}>
          <Button
            size="lg"
            onPress={onGetStarted}
            label="Get Started"
            style={[styles.primaryButton, { backgroundColor: blue }]}
          >
            <View style={[styles.ctaContent, { width: Math.max(width - 128, 220) }]}>
              <Text style={[styles.ctaLabel, { color: brandForeground }]}>Get Started</Text>
              <View style={[styles.ctaArrow, { backgroundColor: brandForeground }]}>
                <ArrowRight color={blue} size={20} strokeWidth={2.5} />
              </View>
            </View>
          </Button>
          <View style={styles.signInRow}>
            <Text variant="caption" style={styles.accountCopy}>Already have an account?</Text>
            <Button variant="link" onPress={onSignIn} label="Sign in">
              Sign in
            </Button>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 22, paddingBottom: 10 },
  titleBlock: { gap: 5 },
  eyebrow: { fontSize: 13, fontWeight: "800", letterSpacing: 1.45 },
  wordmark: { fontSize: 49, lineHeight: 54, fontStyle: "italic", fontWeight: "900", letterSpacing: -2.5 },
  wordmarkDot: { fontSize: 42, fontStyle: "normal", fontWeight: "800" },
  wordmarkVersion: { fontSize: 48, fontStyle: "normal", fontWeight: "800", letterSpacing: -1.5 },
  tagline: { fontSize: 16, fontWeight: "600", lineHeight: 21 },
  artworkFrame: { height: 205, marginHorizontal: -28, marginTop: 4, overflow: "hidden", justifyContent: "flex-end" },
  artwork: { width: "120%", height: 240, alignSelf: "center" },
  features: { gap: 16, paddingTop: 4 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  featureIcon: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  featureCopy: { flex: 1, gap: 2 },
  featureTitle: { fontSize: 17, fontWeight: "700" },
  featureBody: { fontSize: 14, lineHeight: 19 },
  actions: { marginTop: "auto", gap: 15, paddingTop: 24 },
  primaryButton: { width: "100%", borderRadius: 12 },
  ctaContent: { height: 38, alignItems: "center", justifyContent: "center" },
  ctaLabel: { fontSize: 17, fontWeight: "700" },
  ctaArrow: { position: "absolute", right: 0, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  signInRow: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  accountCopy: { fontSize: 14 },
});
