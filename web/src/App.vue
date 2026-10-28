<script setup lang="ts">
import { computed, onMounted } from 'vue';
import {
  NConfigProvider,
  NDialogProvider,
  NGlobalStyle,
  NMessageProvider,
  darkTheme,
  zhTW,
  dateZhTW,
} from 'naive-ui';
import { themeOverrides } from './theme';
import { useAppInfoStore } from './stores/appInfo';
import { useThemeStore } from './stores/theme';

// 亮色／暗色：預設跟隨系統（手機、電腦自動切換時即時跟著變），也可手動指定
const themeStore = useThemeStore();
const theme = computed(() => (themeStore.isDark ? darkTheme : null));

const appInfo = useAppInfoStore();
onMounted(() => appInfo.load().catch(() => undefined));
</script>

<template>
  <NConfigProvider
    :theme="theme"
    :theme-overrides="themeOverrides"
    :locale="zhTW"
    :date-locale="dateZhTW"
  >
    <NGlobalStyle />
    <NMessageProvider>
      <NDialogProvider>
        <RouterView />
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>
