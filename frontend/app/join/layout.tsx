import { CheckoutShell } from "@/components/customer/checkout-shell";

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return <CheckoutShell>{children}</CheckoutShell>;
}
