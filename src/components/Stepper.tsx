import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";

export interface StepDef {
  label: string;
  icon: LucideIcon;
}

export default function Stepper({ steps, current }: { steps: StepDef[]; current: number }) {
  return (
    <div className="flex items-start">
      {steps.map((step, i) => {
        const stepNumber = i + 1;
        const isCompleted = stepNumber < current;
        const isCurrent = stepNumber === current;
        const Icon = step.icon;

        return (
          <div key={step.label} className={`flex items-center ${i < steps.length - 1 ? "flex-1" : ""}`}>
            <div className="flex flex-col items-center">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  isCompleted
                    ? "border-brand bg-brand text-white"
                    : isCurrent
                      ? "border-brand bg-white text-brand"
                      : "border-line bg-white text-slate"
                }`}
              >
                {isCompleted ? <Check size={16} strokeWidth={3} /> : <Icon size={16} strokeWidth={2.25} />}
              </div>
              <span
                className={`mt-2 whitespace-nowrap text-xs font-medium ${
                  isCompleted || isCurrent ? "text-brand" : "text-slate"
                }`}
              >
                {step.label}
              </span>
            </div>

            {i < steps.length - 1 && (
              <div className={`mx-2 mt-[18px] h-0.5 flex-1 ${isCompleted ? "bg-brand" : "bg-line"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
