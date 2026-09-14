import { useAuth } from "@clerk/expo";
import { Redirect } from "expo-router";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Spinner } from "@/components/ui/spinner";
import { View } from "@/components/ui/view";
import { useColor } from "@/hooks/useColor";
import { signedInHomeRoute } from "@/auth-routes";

export default function OAuthNativeCallbackScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const background = useColor("background");

  if (isLoaded && isSignedIn) return <Redirect href={signedInHomeRoute} />;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: background }]}>
      <View style={styles.content}>
        <Spinner label="Finishing Google sign-in" showLabel />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, alignItems: "center", justifyContent: "center" },
});
