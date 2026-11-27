import { useSelector, useDispatch } from "react-redux";
import { useTranslation } from "@/hooks/use-translation";
import {
  formatCurrency as formatCurrencyUtil,
  formatCentsAsCurrency,
  getCurrencySymbol,
  LOCALE_TO_CURRENCY,
} from "@/lib/currency";
import type { Currency } from "@shared/schema-mongo";
import type { RootState, AppDispatch } from "../app/store";
import { updatePreferredCurrency } from "../features/auth/authSlice";

export function useCurrency() {
  const { user } = useSelector((state: RootState) => state.auth);
  const { locale } = useTranslation();
  const dispatch = useDispatch<AppDispatch>();

  const currency: Currency =
    (user?.preferredCurrency as Currency | undefined) ?? LOCALE_TO_CURRENCY[locale];

  const formatCurrency = (amountUsd: number, options?: Intl.NumberFormatOptions) =>
    formatCurrencyUtil(amountUsd, currency, options);

  const formatCents = (centsUsd: number, options?: Intl.NumberFormatOptions) =>
    formatCentsAsCurrency(centsUsd, currency, options);

  const setCurrency = async (newCurrency: Currency) => {
    await dispatch(updatePreferredCurrency(newCurrency)).unwrap();
  };

  const currencySymbol = getCurrencySymbol(currency);

  return {
    currency,
    currencySymbol,
    formatCurrency,
    formatCents,
    setCurrency,
    isLoggedIn: !!user,
  };
}
