import { useAuth } from "@clerk/expo";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColor } from "@/hooks/useColor";

export default function HomeRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  const background = useColor("background");

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/" />;

  return <SafeAreaView style={{ flex: 1, backgroundColor: background }} />;
}
