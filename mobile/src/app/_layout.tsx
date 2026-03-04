import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useSession } from '@/lib/auth/use-session';
import { useEffect } from 'react';
import { Linking } from 'react-native';

export const unstable_settings = {
  initialRouteName: 'sign-in',
};

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function parseCallUrl(url: string): { sessionId: string; callerName: string; roomUrl: string } | null {
  try {
    // Handle vibecode://call?sessionId=X&callerName=Y&roomUrl=Z
    const withHttp = url.replace(/^vibecode:\/\//, 'https://vibecode.app/');
    const parsed = new URL(withHttp);
    const pathname = parsed.pathname.replace(/^\//, '');
    if (pathname !== 'call') return null;
    const sessionId = parsed.searchParams.get('sessionId');
    const callerName = parsed.searchParams.get('callerName');
    const roomUrl = parsed.searchParams.get('roomUrl');
    if (!sessionId || !callerName || !roomUrl) return null;
    return { sessionId, callerName, roomUrl };
  } catch {
    return null;
  }
}

function RootLayoutNav() {
  const { data: session, isLoading } = useSession();

  // Handle deep links for incoming calls
  useEffect(() => {
    if (isLoading || !session?.user) return;

    function handleUrl(url: string) {
      const params = parseCallUrl(url);
      if (params) {
        router.push({
          pathname: '/(app)/call',
          params,
        });
      }
    }

    // Cold start: app launched from a deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // Warm start: app already running, link received
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });

    return () => subscription.remove();
  }, [isLoading, session?.user?.id]);

  if (isLoading) return null;

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!!session?.user}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!session?.user}>
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="sign-up" />
          <Stack.Screen name="forgot-password" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <StatusBar style="light" />
          <RootLayoutNav />
        </KeyboardProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
