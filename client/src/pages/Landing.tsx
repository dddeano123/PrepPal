import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ChefHat, Scale, ShoppingCart, Target, ArrowRight, CheckCircle } from "lucide-react";

export default function Landing() {
  const features = [
    {
      icon: Scale,
      title: "Accurate Macros",
      description: "Gram-based inputs with USDA authoritative nutrition data. No more guessing.",
    },
    {
      icon: Target,
      title: "Recipe-Centric",
      description: "Define once, reuse forever. Perfect for meal preppers who eat the same meals.",
    },
    {
      icon: ShoppingCart,
      title: "Smart Shopping",
      description: "Generate consolidated shopping lists from selected recipes automatically.",
    },
  ];

  const benefits = [
    "Stable macros that don't change over time",
    "No crowdsourced data drift",
    "Minimal re-entry after initial setup",
    "Clear per-serving calculations",
    "Ingredient consolidation across recipes",
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-primary p-1.5">
                <ChefHat className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold" data-testid="text-app-name">PrepPal</span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button asChild data-testid="button-login-header">
                <a href="/api/login">Log in</a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6">
              <Target className="h-4 w-4" />
              <span className="text-sm font-medium">For meal preppers who care about accuracy</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Stable macros for
              <span className="text-primary block">repeatable meals</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              A recipe-centric nutrition app that replaces MyFitnessPal for home cooking. 
              Define once, calculate accurately, prep confidently.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild data-testid="button-get-started">
                <a href="/api/login" className="gap-2">
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </section>

        <section className="py-16 px-4 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <Card key={index} className="border-0 bg-card">
                  <CardContent className="pt-6">
                    <div className="rounded-md bg-primary/10 p-3 w-fit mb-4">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Why PrepPal?</h2>
              <p className="text-lg text-muted-foreground">
                Most nutrition apps are daily-log oriented and rely on inaccurate crowdsourced data.
                PrepPal is different.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {benefits.map((benefit, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-4 rounded-md bg-card border border-card-border"
                >
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 px-4 bg-primary text-primary-foreground">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to prep with precision?</h2>
            <p className="text-lg opacity-90 mb-8">
              Join meal preppers who want accurate macros without the daily logging hassle.
            </p>
            <Button
              size="lg"
              variant="secondary"
              asChild
              data-testid="button-cta-bottom"
            >
              <a href="/api/login" className="gap-2">
                Start Free
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </section>
      </main>

      <footer className="py-8 px-4 border-t border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary p-1">
              <ChefHat className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-medium">PrepPal</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Nutrition data from USDA FoodData Central
          </p>
        </div>
      </footer>
    </div>
  );
}
