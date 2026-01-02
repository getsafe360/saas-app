// components/site-cockpit/cards/TechnologyCard.tsx
import { CockpitCard } from "./CockpitCard";
import type { Technology } from "@/types/site-cockpit";

interface TechnologyCardProps {
  data: Technology;
}

export function TechnologyCard({ data }: TechnologyCardProps) {
  return (
    <CockpitCard id="technology" category={"tech" as any} title="Technology">
      <div className="space-y-4">
        {/* CMS Info */}
        {data.cms && (
          <div>
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Content Management System
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  CMS
                </span>
                <span className="text-sm font-medium">{data.cms.name}</span>
              </div>
              {data.cms.version && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Version
                  </span>
                  <span className="text-sm font-medium">
                    {data.cms.version}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Server Info */}
        {data.server && (
          <div>
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Server
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Software
                </span>
                <span className="text-sm font-medium">
                  {data.server.software}
                </span>
              </div>
              {data.server.version && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Version
                  </span>
                  <span className="text-sm font-medium">
                    {data.server.version}
                  </span>
                </div>
              )}
              {data.server.os && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    OS
                  </span>
                  <span className="text-sm font-medium">{data.server.os}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Languages */}
        {(() => {
          const lang = (data as any).language;
          if (!lang) return null;
          return (
            <div>
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Programming Language
              </h4>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300">
                  {lang.name}
                  {lang.version && ` ${lang.version}`}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Frameworks */}
        {data.frameworks && (
          <div>
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Frameworks
            </h4>
            <div className="space-y-3">
              {data.frameworks.backend &&
                data.frameworks.backend.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Backend
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {data.frameworks.backend.map((framework) => (
                        <span
                          key={framework}
                          className="text-xs px-2 py-1 rounded-full bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300"
                        >
                          {framework}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              {data.frameworks.frontend &&
                data.frameworks.frontend.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Frontend
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {data.frameworks.frontend.map((framework) => (
                        <span
                          key={framework}
                          className="text-xs px-2 py-1 rounded-full bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300"
                        >
                          {framework}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* Database */}
        {(() => {
          const db = (data as any).database;
          if (!db) return null;
          return (
            <div>
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Database
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Type
                  </span>
                  <span className="text-sm font-medium">{db.type}</span>
                </div>
                {db.version && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Version
                    </span>
                    <span className="text-sm font-medium">{db.version}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* CDN */}
        {data.cdn && (Array.isArray(data.cdn) ? data.cdn.length > 0 : true) && (
          <div>
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              CDN Services
            </h4>
            <div className="flex flex-wrap gap-2">
              {(Array.isArray(data.cdn) ? data.cdn : [data.cdn]).map(
                (cdnItem, idx) => {
                  const label =
                    typeof cdnItem === "string"
                      ? cdnItem
                      : cdnItem.provider ?? String(cdnItem);
                  const key =
                    typeof cdnItem === "string" ? cdnItem : `${label}-${idx}`;
                  return (
                    <span
                      key={key}
                      className="text-xs px-2 py-1 rounded-full bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-300"
                    >
                      {label}
                    </span>
                  );
                }
              )}
            </div>
          </div>
        )}

        {/* Analytics */}
        {data.analytics && data.analytics.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Analytics & Tracking
            </h4>
            <div className="flex flex-wrap gap-2">
              {data.analytics.map((tool) => (
                <span
                  key={tool}
                  className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Libraries */}
        {(() => {
          const libs = Array.isArray(data.libraries)
            ? data.libraries
            : data.libraries
            ? (Object.values(data.libraries as any).filter(Boolean) as string[])
            : [];
          if (libs.length === 0) return null;
          return (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                JavaScript Libraries ({libs.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {libs.slice(0, 6).map((lib) => (
                  <span
                    key={lib}
                    className="text-xs px-2 py-1 rounded-full bg-sky-50 dark:bg-sky-950/20 text-sky-700 dark:text-sky-300"
                  >
                    {lib}
                  </span>
                ))}
                {libs.length > 6 && (
                  <span className="text-xs px-2 py-1 text-slate-500 dark:text-slate-400">
                    +{libs.length - 6} more
                  </span>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </CockpitCard>
  );
}
