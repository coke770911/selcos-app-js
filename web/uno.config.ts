import { defineConfig, presetWind3 } from 'unocss';

export default defineConfig({
  // dark: 由 <html class="dark"> 控制（stores/theme.ts 依跟隨系統／亮色／暗色設定）
  presets: [presetWind3({ dark: 'class' })],
  theme: {
    colors: {
      brand: '#7C5CFF',
    },
  },
});
