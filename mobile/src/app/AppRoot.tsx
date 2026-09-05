import { NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';

import { colors } from '../design-system/theme';
import { MainTabNavigator } from './MainTabNavigator';
import { PhotoSourceScreen } from '../features/photo-source/PhotoSourceScreen';
import { RecordDetailScreen } from '../features/record-detail/RecordDetailScreen';
import { RecordEditorScreen } from '../features/record-editor/RecordEditorScreen';
import { StampAlbumScreen } from '../features/stamps/StampAlbumScreen';
import { AccountScreen } from '../features/account/AccountScreen';
import { MembershipScreen } from '../features/membership/MembershipScreen';
import { PrivacyDataScreen } from '../features/privacy/PrivacyDataScreen';
import { SearchScreen } from '../features/search/SearchScreen';
import { PassportScreen } from '../features/passport/PassportScreen';
import { MonthlyRecapScreen } from '../features/monthly-recap/MonthlyRecapScreen';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import type { RootStackParamList } from './navigation';
import { ServicesProvider } from './ServicesContext';
import { createAppServices, type AppServices } from './services';

enableScreens(true);

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme: Theme = {
  dark: false,
  colors: {
    primary: colors.creamDeep,
    background: colors.paper,
    card: colors.paper,
    text: colors.ink,
    border: colors.line,
    notification: colors.blush,
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' },
    medium: { fontFamily: 'System', fontWeight: '500' },
    bold: { fontFamily: 'System', fontWeight: '700' },
    heavy: { fontFamily: 'System', fontWeight: '800' },
  },
};

export const AppRoot = () => {
  const [bootState, setBootState] = useState<{
    services: AppServices;
    initialRoute: 'Onboarding' | 'MainTabs';
  } | null>(null);
  const [bootError, setBootError] = useState(false);

  useEffect(() => {
    let mounted = true;
    createAppServices()
      .then(async value => {
        const profile = await value.creativeRepository.getProfile();
        if (mounted) {
          setBootState({
            services: value,
            initialRoute: profile.onboardingCompletedAt
              ? 'MainTabs'
              : 'Onboarding',
          });
        }
      })
      .catch(() => {
        if (mounted) {
          setBootError(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!bootState) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <View style={styles.boot}>
          {bootError ? (
            <>
              <Text style={styles.bootTitle}>暂时没有打开日记</Text>
              <Text style={styles.bootText}>
                本地记录没有完成初始化。你的照片不会被上传或删除，请重新启动后再试。
              </Text>
            </>
          ) : (
            <>
              <ActivityIndicator color={colors.creamDeep} />
              <Text style={styles.bootText}>正在翻开今天这一页…</Text>
            </>
          )}
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <ServicesProvider services={bootState.services}>
        <NavigationContainer theme={navigationTheme}>
          <Stack.Navigator
            initialRouteName={bootState.initialRoute}
            screenOptions={{
              headerShadowVisible: false,
              headerStyle: { backgroundColor: colors.paper },
              headerTintColor: colors.ink,
              contentStyle: { backgroundColor: colors.paper },
              headerBackTitle: '返回',
            }}
          >
            <Stack.Screen
              name="Onboarding"
              component={OnboardingScreen}
              options={{ headerShown: false, gestureEnabled: false }}
            />
            <Stack.Screen
              name="MainTabs"
              component={MainTabNavigator}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PhotoSource"
              component={PhotoSourceScreen}
              options={{ title: '记录这一杯' }}
            />
            <Stack.Screen
              name="Editor"
              component={RecordEditorScreen}
              options={{ title: '这一杯的样子' }}
            />
            <Stack.Screen
              name="Detail"
              component={RecordDetailScreen}
              options={{ title: '饮品日记' }}
            />
            <Stack.Screen
              name="StampAlbum"
              component={StampAlbumScreen}
              options={{ title: '我的饮印册' }}
            />
            <Stack.Screen name="Account" component={AccountScreen} options={{ title: '登录与账号' }} />
            <Stack.Screen name="Membership" component={MembershipScreen} options={{ title: '会员中心' }} />
            <Stack.Screen name="PrivacyData" component={PrivacyDataScreen} options={{ title: '隐私与数据' }} />
            <Stack.Screen name="Search" component={SearchScreen} options={{ title: '搜索回忆' }} />
            <Stack.Screen name="Passport" component={PassportScreen} options={{ title: '饮品护照' }} />
            <Stack.Screen name="MonthlyRecap" component={MonthlyRecapScreen} options={{ title: '本月小刊' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </ServicesProvider>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
    backgroundColor: colors.paper,
  },
  bootTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '700',
  },
  bootText: {
    color: colors.inkMuted,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
});
