import { useAuth } from "@clerk/expo";
import { Redirect, Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MainTabIcon } from "@/components/main-tab-icon";
import { useColor } from "@/hooks/useColor";

export default function MainTabsLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const insets = useSafeAreaInsets();
  const background = useColor("background");
  const border = useColor("border");
  const blue = useColor("blue");
  const brandForeground = useColor("brandForeground");
  const inactive = useColor("textMuted");

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/" />;

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: background },
        tabBarActiveTintColor: blue,
        tabBarInactiveTintColor: inactive,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          lineHeight: 16,
        },
        tabBarStyle: {
          height: 64 + insets.bottom,
          paddingTop: 7,
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: background,
          borderTopColor: border,
          borderTopWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarAccessibilityLabel: "Home",
          tabBarIcon: ({ color, focused }) => (
            <MainTabIcon name="home" color={color} cutoutColor={brandForeground} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: "Report",
          tabBarAccessibilityLabel: "Report",
          tabBarIcon: ({ color, focused }) => (
            <MainTabIcon name="report" color={color} cutoutColor={brandForeground} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="track"
        options={{
          title: "Track",
          tabBarAccessibilityLabel: "Track",
          tabBarIcon: ({ color, focused }) => (
            <MainTabIcon name="track" color={color} cutoutColor={brandForeground} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "Insights",
          tabBarAccessibilityLabel: "Insights",
          tabBarIcon: ({ color, focused }) => (
            <MainTabIcon name="insights" color={color} cutoutColor={brandForeground} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarAccessibilityLabel: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <MainTabIcon name="profile" color={color} cutoutColor={brandForeground} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
