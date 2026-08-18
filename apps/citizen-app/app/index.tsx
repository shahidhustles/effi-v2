import { Link } from "expo-router";
import { Text } from "react-native";
import { Eyebrow, Screen } from "@effi/ui-native";

export default function HomeScreen() {
  return <Screen><Eyebrow>Citizen app shell</Eyebrow><Text style={{ fontSize: 30, fontWeight: "700", marginTop: 12 }}>Report civic issues clearly.</Text><Link href="/report" style={{ marginTop: 24 }}>Start a report</Link><Link href="/cases" style={{ marginTop: 16 }}>Track a case</Link></Screen>;
}
