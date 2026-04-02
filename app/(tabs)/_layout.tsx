import { Stack } from 'expo-router';
import React from 'react';

export default function Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="attendance" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="leave" />
      <Stack.Screen name="att-history" />
      <Stack.Screen name="holidays" />
      <Stack.Screen name="index" />
    </Stack>
  );
}
