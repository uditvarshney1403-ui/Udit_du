# Titan Company – Intrinsic Value Estimation

## Overview

This repository contains a comprehensive **equity valuation workbook** for **Titan Company Limited (NSE: TITAN | BSE: 500114)** prepared as part of an assignment on fundamental equity analysis and valuation.

---

## File

| File | Description |
|------|-------------|
| `Titan_Intrinsic_Value_Analysis.xlsx` | Full valuation workbook with live Excel formulas |

---

## Workbook Structure (8 Sheets)

| Sheet | Contents |
|-------|----------|
| **Cover** | Title page, model justification, report summary |
| **Financial_Data** | Historical EPS, DPS, BVPS, ROE, Net Income, Capex, Depreciation, ΔWCA (FY2019–FY2024) with CAGR formulas |
| **Beta_Estimation** | OLS regression of 36 monthly Titan returns vs Nifty 50 (Jan 2021 – Dec 2023); manual β computation + SLOPE/INTERCEPT cross-checks, R², t-statistic |
| **CAPM_Cost_of_Equity** | CAPM: ke = Rf + β × (Rm − Rf); Rf = 91-Day T-Bill = 7.0%, ERP = 5.5%; ke ≈ 11.84% |
| **Growth_Rate** | Three approaches: (1) Historical EPS CAGR, (2) Sustainable Growth = ROE × Retention Ratio, (3) Analyst consensus; adopted g₁ = 17%, g₂ = 6% |
| **FCFE_Valuation** | Two-stage FCFE model: 5-year high-growth phase (g₁ = 17%) + terminal value (g₂ = 6%); intrinsic value ≈ **₹443/share** vs CMP ₹3,200 |
| **Sensitivity_Analysis** | Two data tables varying g₁ & g₂ and g₁ & ke; line chart of IV vs g₁ with CMP reference |
| **Investment_Assessment** | Bull/Bear/Base comparison dashboard, investment verdict, 8 critical model limitations |

---

## Key Results

| Metric | Value |
|--------|-------|
| Beta (OLS, 36-month) | ~0.88 |
| Risk-Free Rate (91-Day T-Bill) | 7.00% |
| Equity Risk Premium | 5.50% |
| **Cost of Equity (ke)** | **~11.84%** |
| Adopted High-Growth Rate (g₁) | 17% (5 years) |
| Terminal Growth Rate (g₂) | 6% |
| **Base-Case Intrinsic Value** | **₹443/share** |
| Current Market Price (Apr 2024) | ₹3,200 |
| Market Premium over IV | ~623% |

---

## Valuation Model Justification

The **Two-Stage Free Cash Flow to Equity (FCFE)** model is selected because:
1. Titan's low dividend payout (~28%) makes DDM unreliable  
2. FCFE captures cash available to equity holders after real reinvestment needs (gold inventory WCA)  
3. Two-stage model realistically reflects a high-growth phase transitioning to stable growth  
4. More rigorous than P/E multiplier for a premium consumer brand

---

## Limitations

The model undervalues Titan significantly due to brand equity (Tanishq), distribution moat, and growth optionality not captured by FCFE. The ~623% market premium likely reflects these intangibles. Full limitations are documented in the **Investment_Assessment** sheet.
