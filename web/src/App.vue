<script setup lang="ts">
import { computed, onMounted } from 'vue';
import {
  NConfigProvider,
  NDialogProvider,
  NGlobalStyle,
  NMessageProvider,
  darkTheme,
  useOsTheme,
  zhTW,
  dateZhTW,
} from 'naive-ui';
import { themeOverrides } from './theme';
import { useAppInfoStore } from './stores/appInfo';

const osTheme = useOsTheme();
const theme = computed(() => (osTheme.value === 'dark' ? darkTheme : null));

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
