export type PayrollEmployee = {
  salary?: number;
  netSalary?: number;
  basic?: number;
  hra?: number;
  specialAllowance?: number;
  bonus?: number;
  overtime?: number;
  pf?: number;
  esi?: number;
  incomeTax?: number;
  professionalTax?: number;
  healthInsurance?: number;
  loanRecovery?: number;
  lop?: number;
  employerPfContribution?: number;
  deductionsEnabled?: boolean;
};

const numberValue = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatCurrency = (value: unknown) =>
  `Rs. ${numberValue(value).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

export const buildPayrollBreakdown = (employee: PayrollEmployee) => {
  const earnings = [
    { key: "basic", label: "Basic", value: numberValue(employee.basic) },
    { key: "hra", label: "HRA", value: numberValue(employee.hra) },
    { key: "specialAllowance", label: "Special Allowance", value: numberValue(employee.specialAllowance) },
    { key: "bonus", label: "Bonus", value: numberValue(employee.bonus) },
    { key: "overtime", label: "Overtime", value: numberValue(employee.overtime) },
  ];

  const deductions = [
    { key: "pf", label: "Provident Fund", value: numberValue(employee.pf) },
    { key: "esi", label: "ESI", value: numberValue(employee.esi) },
    { key: "incomeTax", label: "Income Tax", value: numberValue(employee.incomeTax) },
    { key: "professionalTax", label: "Professional Tax", value: numberValue(employee.professionalTax) },
    { key: "healthInsurance", label: "Health Insurance", value: numberValue(employee.healthInsurance) },
    { key: "loanRecovery", label: "Loan Recovery", value: numberValue(employee.loanRecovery) },
    { key: "lop", label: "LOP", value: numberValue(employee.lop) },
  ];

  const grossSalary = earnings.reduce((sum, item) => sum + item.value, 0);
  const deductionTotal = employee.deductionsEnabled ? deductions.reduce((sum, item) => sum + item.value, 0) : 0;
  const derivedNet = Math.max(0, grossSalary - deductionTotal);
  const netSalary = numberValue(employee.netSalary) > 0 ? numberValue(employee.netSalary) : derivedNet;

  return {
    earnings,
    deductions,
    grossSalary,
    deductionTotal,
    netSalary,
    employerPfContribution: numberValue(employee.employerPfContribution),
  };
};

export const normalizePayrollNumberInput = (value: string) => {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 2) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
};
