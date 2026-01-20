'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary 組件
 * 用於捕獲子組件樹中的錯誤，提供優雅的降級方案
 * 特別針對地圖組件等可能失敗的第三方整合
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 記錄錯誤到監控服務（如 Sentry）
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // 如果有自定義 fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 預設降級 UI
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-stone-50 rounded-lg border border-stone-200">
          <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            載入時發生錯誤
          </h3>
          <p className="text-sm text-slate-600 mb-4 text-center max-w-md">
            我們無法載入此內容。請重新整理頁面或稍後再試。
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-4 py-2 bg-[#10B8D9] text-white rounded-lg hover:bg-[#10B8D9]/80 transition-colors"
          >
            重新載入
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
