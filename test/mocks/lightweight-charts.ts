/**
 * Vitest version of the lightweight-charts mock.
 * Re-uses vi directly (globals: true is set in vitest.config.ts).
 * The jest.* calls in the .js version also work once vitest-compat shim is
 * loaded, but this TypeScript version is cleaner for new references.
 */

const mockSeries = {
  setData: vi.fn(),
  update: vi.fn(),
  applyOptions: vi.fn(),
  priceScale: vi.fn().mockReturnValue({ applyOptions: vi.fn() }),
};

const mockTimeScale = {
  fitContent: vi.fn(),
  setVisibleRange: vi.fn(),
  setVisibleLogicalRange: vi.fn(),
  getVisibleRange: vi.fn().mockReturnValue({ from: 0, to: 100 }),
  getVisibleLogicalRange: vi.fn().mockReturnValue({ from: 0, to: 100 }),
  applyOptions: vi.fn(),
  scrollToPosition: vi.fn(),
  scrollToRealTime: vi.fn(),
  subscribeVisibleTimeRangeChange: vi.fn(),
  subscribeVisibleLogicalRangeChange: vi.fn(),
  unsubscribeVisibleTimeRangeChange: vi.fn(),
  unsubscribeVisibleLogicalRangeChange: vi.fn(),
};

const createMockSeries = () => ({
  setData: vi.fn(),
  update: vi.fn(),
  applyOptions: vi.fn(),
  priceScale: vi.fn().mockReturnValue({ applyOptions: vi.fn() }),
});

const mockChart = {
  addSeries: vi.fn().mockImplementation(() => createMockSeries()),
  addCandlestickSeries: vi.fn().mockReturnValue(mockSeries),
  addHistogramSeries: vi.fn().mockReturnValue(mockSeries),
  addLineSeries: vi.fn().mockReturnValue(mockSeries),
  addAreaSeries: vi.fn().mockReturnValue(mockSeries),
  addBarSeries: vi.fn().mockReturnValue(mockSeries),
  addBaselineSeries: vi.fn().mockReturnValue(mockSeries),
  removeSeries: vi.fn(),
  timeScale: vi.fn().mockReturnValue(mockTimeScale),
  priceScale: vi.fn().mockReturnValue({ applyOptions: vi.fn() }),
  applyOptions: vi.fn(),
  resize: vi.fn(),
  remove: vi.fn(),
  subscribeCrosshairMove: vi.fn(),
  unsubscribeCrosshairMove: vi.fn(),
  subscribeClick: vi.fn(),
  unsubscribeClick: vi.fn(),
};

export const createChart = vi.fn().mockReturnValue(mockChart);
export const CandlestickSeries = 'CandlestickSeries';
export const HistogramSeries = 'HistogramSeries';
export const LineSeries = 'LineSeries';
export const AreaSeries = 'AreaSeries';
export const BarSeries = 'BarSeries';
export const BaselineSeries = 'BaselineSeries';

export const __mockChart = mockChart;
export const __mockSeries = mockSeries;
export const __mockTimeScale = mockTimeScale;
export const __createMockSeries = createMockSeries;
