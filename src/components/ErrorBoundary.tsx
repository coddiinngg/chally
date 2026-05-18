import React from "react";
import { captureException } from "../lib/sentry";

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren<object>, ErrorBoundaryState> {
  declare readonly props: Readonly<React.PropsWithChildren<object>>;

  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("Unhandled app error:", error);
    captureException(error, { componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-white px-6 text-center text-slate-900">
          <div>
            <h1 className="text-[20px] font-black">앱을 다시 불러와주세요</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
              일시적인 오류가 발생했어요. 새로고침 후에도 반복되면 잠시 후 다시 시도해주세요.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-2xl bg-slate-900 px-5 py-3 text-[14px] font-bold text-white"
            >
              새로고침
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
