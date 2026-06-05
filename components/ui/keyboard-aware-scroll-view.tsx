import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import {
  findNodeHandle,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ScrollViewProps,
  TextInput,
} from "react-native";

type KeyboardAwareScrollViewProps = ScrollViewProps & {
  extraScrollHeight?: number;
  keyboardVerticalOffset?: number;
  avoidKeyboard?: boolean;
};

const KeyboardAwareScrollView = forwardRef<ScrollView, KeyboardAwareScrollViewProps>(
  (
    {
      children,
      extraScrollHeight = 96,
      keyboardVerticalOffset = 0,
      avoidKeyboard = true,
      keyboardShouldPersistTaps = "handled",
      keyboardDismissMode = Platform.OS === "ios" ? "interactive" : "on-drag",
      ...rest
    },
    ref
  ) => {
    const scrollRef = useRef<ScrollView>(null);

    useImperativeHandle(ref, () => scrollRef.current as ScrollView);

    const scrollToFocusedInput = useCallback(() => {
      const focusedInput = TextInput.State.currentlyFocusedInput?.();
      const scrollResponder = scrollRef.current as ScrollView & {
        scrollResponderScrollNativeHandleToKeyboard?: (
          nodeHandle: number,
          additionalOffset?: number,
          preventNegativeScrollOffset?: boolean
        ) => void;
      };

      if (!focusedInput || !scrollResponder?.scrollResponderScrollNativeHandleToKeyboard) {
        return;
      }

      const handle = findNodeHandle(focusedInput);
      if (!handle) return;

      requestAnimationFrame(() => {
        scrollResponder.scrollResponderScrollNativeHandleToKeyboard?.(handle, extraScrollHeight, true);
      });
    }, [extraScrollHeight]);

    useEffect(() => {
      const eventName = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
      const showSubscription = Keyboard.addListener(eventName, () => {
        setTimeout(scrollToFocusedInput, Platform.OS === "ios" ? 50 : 120);
      });

      return () => {
        showSubscription.remove();
      };
    }, [scrollToFocusedInput]);

    const content = (
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={keyboardDismissMode}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        {...rest}
      >
        {children}
      </ScrollView>
    );

    if (!avoidKeyboard) {
      return content;
    }

    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {content}
      </KeyboardAvoidingView>
    );
  }
);

KeyboardAwareScrollView.displayName = "KeyboardAwareScrollView";

export default KeyboardAwareScrollView;
