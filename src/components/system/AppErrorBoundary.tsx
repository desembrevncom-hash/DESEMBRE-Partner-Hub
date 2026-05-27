import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isReporting: boolean;
  reported: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    isReporting: false,
    reported: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, isReporting: false, reported: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    
    // Fire and forget logging
    this.logErrorToDatabase(error, errorInfo);
  }

  private async logErrorToDatabase(error: Error, errorInfo: ErrorInfo) {
    try {
      // Don't await, let it run in background
      const userRes = await supabase.auth.getUser();
      const userId = userRes.data.user?.id;
      
      await supabase.from('app_error_logs' as any).insert({
        user_id: userId || null,
        page_key: window.location.pathname,
        error_type: error.name || 'RuntimeError',
        error_message: error.message,
        stack_trace: error.stack || errorInfo.componentStack,
        metadata: {
          userAgent: navigator.userAgent,
          url: window.location.href
        }
      });
    } catch (e) {
      console.error("Failed to log error to database", e);
    }
  }

  private handleManualReport = async () => {
    if (!this.state.error || this.state.reported || this.state.isReporting) return;
    
    this.setState({ isReporting: true });
    try {
      await this.logErrorToDatabase(this.state.error, { componentStack: 'Manual Report' });
      this.setState({ reported: true, isReporting: false });
    } catch (e) {
      this.setState({ isReporting: false });
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] h-full w-full flex items-center justify-center p-6 bg-slate-50/50">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto border-4 border-rose-50">
              <AlertOctagon className="w-8 h-8 text-rose-500" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Đã có lỗi xảy ra</h2>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">
                Hệ thống gặp sự cố không mong muốn khi tải trang này. Lỗi đã được ghi nhận tự động.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <button 
                onClick={this.handleReload}
                className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <RefreshCw className="w-4 h-4" />
                Tải lại trang
              </button>
              
              <button 
                onClick={this.handleManualReport}
                disabled={this.state.reported || this.state.isReporting}
                className="w-full sm:w-auto px-6 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {this.state.reported ? 'Đã báo cáo' : this.state.isReporting ? 'Đang gửi...' : 'Báo lỗi chi tiết'}
              </button>
            </div>
            
            <p className="text-[10px] text-slate-400 font-medium pt-4 border-t border-slate-100">
              Vui lòng không thao tác thêm nếu lỗi lặp lại liên tục.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
