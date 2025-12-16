import React, { useEffect, useState } from "react";
import { Stack, useSegments, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, View, StyleSheet } from "react-native";

const checkLoggedIn = async (): Promise<boolean> => {
  try {
    const userId = await AsyncStorage.getItem("userEmpId");
    return !!userId;
  } catch (e) {
    return false;
  }
};

function AuthGuard() {
  const segments = useSegments();
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const inTabsGroup = segments[0] === '(tabs)';

  useEffect(() => {
    const loadState = async () => {
      const loggedInStatus = await checkLoggedIn();
      setIsLoggedIn(loggedInStatus);
      setIsLoaded(true);
    };
    loadState();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    if (isLoggedIn && !inTabsGroup) {
      router.replace("/(tabs)/attendance");
    } else if (!isLoggedIn && inTabsGroup) {
      router.replace("/");
    }
  }, [isLoaded, isLoggedIn, inTabsGroup, router]);

  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2c3e50" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <>
      <AuthGuard />
      <Toast />
    </>
  );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ffffff',
    },
});