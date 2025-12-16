if(NOT TARGET hermes-engine::libhermes)
add_library(hermes-engine::libhermes SHARED IMPORTED)
set_target_properties(hermes-engine::libhermes PROPERTIES
    IMPORTED_LOCATION "/Users/barath/.gradle/caches/8.14.3/transforms/e5d19bd6b3826afe5eb577927188e196/transformed/hermes-android-0.81.5-debug/prefab/modules/libhermes/libs/android.x86/libhermes.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/barath/.gradle/caches/8.14.3/transforms/e5d19bd6b3826afe5eb577927188e196/transformed/hermes-android-0.81.5-debug/prefab/modules/libhermes/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

