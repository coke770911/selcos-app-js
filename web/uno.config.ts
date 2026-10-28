import { defineConfig, presetWind3 } from 'unocss';

export default defineConfig({
  // dark: 跟著系統深色模式（與 Naive UI 的 useOsTheme 一致）
  presets: [presetWind3({ dark: 'media' })],
  theme: {
    colors: {
      brand: '#7C5CFF',
    },
  },
});
