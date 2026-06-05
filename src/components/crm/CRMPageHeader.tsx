import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CRMPageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode | React.ElementType | any;
  breadcrumbs?: any;
  actions?: React.ReactNode;
  actionButtons?: React.ReactNode;
  badgeText?: string;
  description?: string;
  backTo?: string;
}

export const CRMPageHeader: React.FC<CRMPageHeaderProps> = ({
  title,
  subtitle,
  action,
  icon,
  breadcrumbs,
  actions,
  actionButtons,
  badgeText,
  description,
  backTo,
  className,
  ...props
}) => {
  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      return icon;
    }
    const IconComponent = icon as React.ComponentType<any>;
    return <IconComponent className="w-5 h-5 text-slate-500" />;
  };

  return (
    <div
      className={cn(
        "flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6 border-b border-slate-100 pb-4",
        className,
      )}
      {...props}
    >
      <div className="space-y-1.5 flex-1 min-w-0">
        {/* Breadcrumbs */}
        {breadcrumbs && Array.isArray(breadcrumbs) && (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
            {breadcrumbs.map((bc, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-slate-300">/</span>}
                {bc.href ? (
                  <Link to={bc.href} className="hover:text-slate-700 transition-colors">
                    {bc.label}
                  </Link>
                ) : (
                  <span className="text-slate-500">{bc.label}</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {backTo && (
            <Link
              to={backTo}
              className="mr-1 p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-all shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
          )}
          {icon && (
            <div className="flex items-center justify-center shrink-0">
              {renderIcon()}
            </div>
          )}
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-950 truncate">
            {title}
          </h1>
          {badgeText && (
            <span className="px-2 py-0.5 text-[9px] font-black tracking-wider uppercase bg-slate-100 text-slate-650 rounded-full border border-slate-200 shrink-0">
              {badgeText}
            </span>
          )}
        </div>

        {subtitle && (
          <p className="text-[10px] md:text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
            {subtitle}
          </p>
        )}

        {description && (
          <p className="text-xs text-slate-500 max-w-3xl mt-1 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {(action || actions || actionButtons) && (
        <div className="flex items-center gap-2 shrink-0 md:self-end">
          {action}
          {actions}
          {actionButtons}
        </div>
      )}
    </div>
  );
};
