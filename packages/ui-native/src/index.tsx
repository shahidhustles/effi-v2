import type { PropsWithChildren } from "react";
import { Text, View } from "react-native";

export const Screen = ({ children }: PropsWithChildren) => <View style={{ flex: 1, padding: 24, backgroundColor: "#f7f7f2" }}>{children}</View>;
export const Eyebrow = ({ children }: PropsWithChildren) => <Text style={{ color: "#617067", fontSize: 13, fontWeight: "600", textTransform: "uppercase" }}>{children}</Text>;
