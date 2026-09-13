import Svg, { Path, Text as SvgText } from "react-native-svg";
import { View } from "@/components/ui/view";
import { useColor } from "@/hooks/useColor";

export function EffiMark({ size = 48 }: { size?: number }) {
  const navy = useColor("indigo");

  return (
    <View accessible accessibilityLabel="Effi" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <Path
          d="M8 13.5 24 9l16 4.5v12.2c0 9.4-6.2 15.4-16 19.3C14.2 41.1 8 35.1 8 25.7V13.5Z"
          fill="none"
          stroke={navy}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
        <Path
          d="m16 8-3-4 6 2 5-4 5 4 6-2-3 4"
          fill="none"
          stroke={navy}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <SvgText
          x="24"
          y="32"
          fill={navy}
          fontSize="22"
          fontWeight="800"
          textAnchor="middle"
        >
          E
        </SvgText>
      </Svg>
    </View>
  );
}
