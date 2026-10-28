import type { GlobalThemeOverrides } from 'naive-ui';

/** 活潑風格主題：紫色主色、大圓角、柔和的狀態色 */
export const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#7C5CFF',
    primaryColorHover: '#9479FF',
    primaryColorPressed: '#6A48F0',
    primaryColorSuppl: '#9479FF',
    infoColor: '#3BB2F6',
    successColor: '#22C55E',
    warningColor: '#FFB020',
    errorColor: '#FF5C7A',
    borderRadius: '12px',
    borderRadiusSmall: '8px',
    fontFamily:
      '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, -apple-system, sans-serif',
  },
  Card: { borderRadius: '16px' },
  // 深色模式下 Naive 預設主色按鈕用深色字，改成白字提高對比
  Button: {
    fontWeight: '600',
    textColorPrimary: '#fff',
    textColorHoverPrimary: '#fff',
    textColorPressedPrimary: '#fff',
    textColorFocusPrimary: '#fff',
  },
};
