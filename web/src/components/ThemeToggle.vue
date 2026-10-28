<script setup lang="ts">
import { computed } from 'vue';
import { NButton, NTooltip } from 'naive-ui';
import { useThemeStore } from '@/stores/theme';

/** 主題切換：跟隨系統 → 亮色 → 暗色（預設跟隨系統，手機或電腦自動切換深色時即時跟著變） */
const theme = useThemeStore();

const LABELS = {
  auto: { icon: '🖥️', text: '跟隨系統' },
  light: { icon: '☀️', text: '亮色' },
  dark: { icon: '🌙', text: '暗色' },
} as const;

const current = computed(() => LABELS[theme.mode]);
</script>

<template>
  <NTooltip>
    <template #trigger>
      <NButton
        size="small"
        round
        secondary
        :aria-label="`主題：${current.text}，按一下切換`"
        @click="theme.cycle()"
      >
        {{ current.icon }} {{ current.text }}
      </NButton>
    </template>
    按一下切換：跟隨系統 → 亮色 → 暗色
  </NTooltip>
</template>
