if(NOT TARGET react-native-reanimated::reanimated)
add_library(react-native-reanimated::reanimated SHARED IMPORTED)
set_target_properties(react-native-reanimated::reanimated PROPERTIES
    IMPORTED_LOCATION "/Users/barath/Desktop/Lemonpay/attendancemobile app/attendance-app/node_modules/react-native-reanimated/android/build/intermediates/cxx/Debug/3sbf1r4m/obj/arm64-v8a/libreanimated.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/barath/Desktop/Lemonpay/attendancemobile app/attendance-app/node_modules/react-native-reanimated/android/build/prefab-headers/reanimated"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

