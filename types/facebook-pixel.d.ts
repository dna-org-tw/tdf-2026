declare global {
  interface Window {
    fbq?: {
      (
        action: 'init',
        pixelId: string,
        parameters?: Record<string, any>
      ): void;
      (
        action: 'track' | 'trackCustom',
        eventName: string,
        parameters?: Record<string, any>
      ): void;
      callMethod?: (...args: any[]) => void;
      queue?: any[];
      push?: (...args: any[]) => void;
      loaded?: boolean;
      version?: string;
    };
    _fbq?: any;
  }
}

export {};
