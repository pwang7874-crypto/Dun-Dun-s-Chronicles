import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../design-system/theme';
import { CalendarScreen } from '../features/calendar/CalendarScreen';
import { CreateStudioScreen } from '../features/create-studio/CreateStudioScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { PublishStudioScreen } from '../features/publish-studio/PublishStudioScreen';
import type { MainTabParamList } from './navigation';

const Tab = createBottomTabNavigator<MainTabParamList>();

const icons: Record<keyof MainTabParamList, string> = {
  Diary: '▦',
  Create: '✎',
  Publish: '⌁',
  Profile: '',
};

const labels: Record<keyof MainTabParamList, string> = {
  Diary: '日历',
  Create: '创作',
  Publish: '发布',
  Profile: '我的',
};

interface TabIconProps {
  color: string;
  focused: boolean;
  size: number;
}

const TabIcon = ({
  name,
  color,
  focused,
}: TabIconProps & { name: keyof MainTabParamList }) => name === 'Profile' ? (
  <View accessibilityElementsHidden style={[styles.personIcon, focused && styles.iconActive]}>
    <View style={[styles.personHead, { borderColor: color }]} />
    <View style={[styles.personBody, { borderColor: color }]} />
  </View>
) : (
  <Text
    accessibilityElementsHidden
    style={[styles.icon, { color }, focused && styles.iconActive]}
  >
    {icons[name]}
  </Text>
);

const tabIcons: Record<
  keyof MainTabParamList,
  (props: TabIconProps) => React.JSX.Element
> = {
  Diary: props => <TabIcon {...props} name="Diary" />,
  Create: props => <TabIcon {...props} name="Create" />,
  Publish: props => <TabIcon {...props} name="Publish" />,
  Profile: props => <TabIcon {...props} name="Profile" />,
};

export const MainTabNavigator = () => (
  <Tab.Navigator
    initialRouteName="Diary"
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: colors.creamDeep,
      tabBarInactiveTintColor: colors.inkMuted,
      tabBarLabel: labels[route.name],
      tabBarLabelStyle: styles.label,
      tabBarStyle: styles.bar,
      tabBarItemStyle: styles.item,
      tabBarIcon: tabIcons[route.name],
    })}
  >
    <Tab.Screen name="Diary" component={CalendarScreen} />
    <Tab.Screen name="Create" component={CreateStudioScreen} />
    <Tab.Screen name="Publish" component={PublishStudioScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

const styles = StyleSheet.create({
  bar: {
    height: 78,
    paddingTop: 7,
    paddingBottom: 10,
    backgroundColor: '#FFFDF9',
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 0,
  },
  item: { paddingVertical: 2 },
  label: { fontSize: 11, letterSpacing: 0.4, fontWeight: '700' },
  icon: { fontSize: 21, lineHeight: 24, fontWeight: '700' },
  personIcon: { width: 22, height: 23, alignItems: 'center' },
  personHead: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.7 },
  personBody: { position: 'absolute', bottom: 1, width: 17, height: 10, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderWidth: 1.7, borderBottomWidth: 0 },
  iconActive: { transform: [{ scale: 1.1 }, { rotate: '-2deg' }] },
});
