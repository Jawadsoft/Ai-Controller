import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, MessageSquare, QrCode, Users, ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
              <Car className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-5xl font-bold tracking-tight mb-6">
            DealerIQ
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            AI-powered sales assistant platform for car dealers. Manage inventory, generate QR codes, 
            and let AI engage with customers to capture qualified leads automatically.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => navigate("/auth")}
              size="lg"
              className="text-lg px-8 py-3"
            >
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="text-lg px-8 py-3"
              onClick={() => navigate("/demo")}
            >
              View Demo
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <Card className="text-center">
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary mx-auto mb-4">
                <Car className="h-6 w-6 text-primary-foreground" />
              </div>
              <CardTitle>Inventory Management</CardTitle>
              <CardDescription>
                Easily upload and manage your vehicle inventory with detailed specifications
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent mx-auto mb-4">
                <QrCode className="h-6 w-6 text-accent-foreground" />
              </div>
              <CardTitle>QR Code Generation</CardTitle>
              <CardDescription>
                Generate printable addendums with QR codes for each vehicle automatically
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/20 mx-auto mb-4">
                <MessageSquare className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle>AI Sales Agent</CardTitle>
              <CardDescription>
                AI chatbot engages customers, answers questions, and qualifies leads 24/7
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* How it Works */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold mx-auto">
                1
              </div>
              <h3 className="text-xl font-semibold">Upload Inventory</h3>
              <p className="text-muted-foreground">
                Add your vehicles with VIN, specs, pricing, and photos to the system
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold mx-auto">
                2
              </div>
              <h3 className="text-xl font-semibold">Generate QR Codes</h3>
              <p className="text-muted-foreground">
                Print addendums with QR codes and place them on your vehicles
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold mx-auto">
                3
              </div>
              <h3 className="text-xl font-semibold">Capture Leads</h3>
              <p className="text-muted-foreground">
                Customers scan QR codes, chat with AI, and become qualified leads
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <Card className="text-center py-12">
          <CardContent>
            <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Sales?</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join progressive dealers who are using AI to capture more leads and sell more cars.
            </p>
            <Button 
              onClick={() => navigate("/auth")}
              size="lg"
              className="text-lg px-8 py-3"
            >
              Start Your Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
