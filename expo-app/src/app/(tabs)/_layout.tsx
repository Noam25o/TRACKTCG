import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, View, type ColorValue } from 'react-native';

import { colors } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, focused, scan = false }: { name: IconName; color: ColorValue; focused: boolean; scan?: boolean }) {
  if (scan) {
    return (
      <View style={[styles.scanButton, focused && styles.scanButtonActive]}>
        <Ionicons color={colors.background} name="scan" size={25} />
      </View>
    );
  }

  return <Ionicons color={color} name={focused ? name : (`${name}-outline` as IconName)} size={23} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name="home" />,
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: 'Collection',
          tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name="albums" />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scanner',
          tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name="scan" scan />,
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: 'Marché',
          tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name="stats-chart" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name="person" />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    height: 74,
    paddingBottom: 9,
    paddingTop: 7,
  },
  label: { fontSize: 10, fontWeight: '600' },
  scanButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: colors.surface,
    borderRadius: 23,
    borderWidth: 4,
    height: 50,
    justifyContent: 'center',
    marginTop: -22,
    width: 50,
  },
  scanButtonActive: { backgroundColor: colors.white },
});
