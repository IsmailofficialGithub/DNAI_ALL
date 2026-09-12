import { AppLayout } from "@/components/layout/AppLayout";
import { BrandLogoPositionForm } from "@/components/brand/BrandLogoPositionForm";

const BrandLogoPositionDemo = () => {
  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-2xl space-y-8 p-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">Brand Logo Positioning</h1>
          <p className="text-muted-foreground">
            Choose where your brand logo should sit on templated images.
          </p>
        </header>

        <BrandLogoPositionForm />
      </div>
    </AppLayout>
  );
};

export default BrandLogoPositionDemo;


