import { CheckoutShell } from "@/components/customer/checkout-shell";

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return <CheckoutShell>{children}</CheckoutShell>;
}
