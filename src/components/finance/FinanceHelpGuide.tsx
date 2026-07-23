/**
 * Finance Help Guide Component
 * Displays comprehensive help documentation for the DAIVE Finance Process
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BookOpen, 
  CreditCard, 
  DollarSign, 
  FileText, 
  HelpCircle, 
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Users,
  Calculator,
  MessageSquare,
  ShieldCheck,
  Download
} from 'lucide-react';

export const FinanceHelpGuide = () => {
  const downloadGuide = () => {
    // Open the markdown file in a new tab
    window.open('/DAIVE_FINANCE_PROCESS_GUIDE.md', '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-6 w-6" />
                DAIVE Finance Process - Help Guide
              </CardTitle>
              <CardDescription className="mt-2">
                Complete guide to managing finance and lease processes through DAIVE conversations
              </CardDescription>
            </div>
            <Button onClick={downloadGuide} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Download Full Guide
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Quick Start Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Quick Start Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Before Using Finance Module:</h4>
              <ul className="space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Create finance programs for all credit tiers
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Configure email service (SMTP settings)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Add lender accounts
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Set up encryption key for sensitive data
                </li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Staff Roles:</h4>
              <ul className="space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <strong>Sales:</strong> Guide customers through DAIVE
                </li>
                <li className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <strong>Finance Manager:</strong> Review & approve applications
                </li>
                <li className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <strong>Admin:</strong> Configure programs & settings
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Help Sections */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="step12">Step 12</TabsTrigger>
          <TabsTrigger value="credit">Credit Apps</TabsTrigger>
          <TabsTrigger value="deals">Deal Sheets</TabsTrigger>
          <TabsTrigger value="troubleshoot">Help</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Finance in the DAIVE Journey</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">The 16-Step Client Journey</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Finance discussions occur at <strong>Step 12: Finance Finalization</strong> after the customer has completed lead qualification, vehicle selection, and purchase decision.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">Steps 1-11</Badge>
                    <span className="text-sm font-medium">Pre-Finance Journey</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Greet & Qualify → Identify Vehicle → Budget → Features → Brand → Recommendations → Test Drive → Purchase Decision → Sale Confirmation → Contract Review → Trade-In Discussion
                  </p>
                </div>

                <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-green-600">Step 12</Badge>
                    <span className="text-sm font-medium">Finance Finalization</span>
                  </div>
                  <p className="text-sm">
                    DAIVE switches to Finance Specialist mode and collects: payment method (finance/lease/cash), credit score, down payment, preferred term, and generates credit application.
                  </p>
                </div>

                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">Steps 13-16</Badge>
                    <span className="text-sm font-medium">Post-Finance Journey</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Vehicle Preparation → Delivery & Handover → CSI & Follow-ups → Long-term Relationship
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Step 12 Tab */}
        <TabsContent value="step12" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Step 12: Finance Finalization
              </CardTitle>
              <CardDescription>Understanding the DAIVE finance conversation flow</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="what-happens">
                  <AccordionTrigger>What Happens in Step 12?</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <p className="text-sm">When DAIVE reaches Step 12, the bot automatically:</p>
                    <ol className="text-sm space-y-2 list-decimal list-inside">
                      <li><strong>Switches to Finance Specialist Agent</strong> - Conversation tone changes to focus on financing</li>
                      <li><strong>Asks About Payment Method</strong> - Finance, Lease, or Cash purchase</li>
                      <li><strong>Collects Credit Information</strong> - Credit score estimation</li>
                      <li><strong>Gathers Down Payment Details</strong> - How much customer can put down</li>
                      <li><strong>Calculates Payment Options</strong> - Real-time payment calculations</li>
                      <li><strong>Creates Credit Application</strong> - Generates secure credit application link</li>
                      <li><strong>Sends Email to Customer</strong> - Credit application link via email</li>
                      <li><strong>Generates Deal Sheet</strong> - Creates PDF deal sheet for review</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="conversation-flow">
                  <AccordionTrigger>Conversation Example</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 text-sm">
                      <div className="bg-primary/10 dark:bg-primary/15 p-3 rounded-lg">
                        <p className="font-semibold text-primary dark:text-foreground">DAIVE:</p>
                        <p className="text-primary dark:text-muted-foreground">
                          "Perfect! Now let's discuss financing options for your 2024 Toyota Camry. Would you prefer to finance, lease, or purchase with cash?"
                        </p>
                      </div>
                      
                      <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                        <p className="font-semibold">Customer:</p>
                        <p>"I'd like to finance it"</p>
                      </div>

                      <div className="bg-primary/10 dark:bg-primary/15 p-3 rounded-lg">
                        <p className="font-semibold text-primary dark:text-foreground">DAIVE:</p>
                        <p className="text-primary dark:text-muted-foreground">
                          "Great choice! To give you the most accurate rates, may I ask what your estimated credit score is? (Excellent: 750+, Good: 700-749, Fair: 650-699, or Poor: Below 650)"
                        </p>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                        <p className="font-semibold">Customer:</p>
                        <p>"Around 720"</p>
                      </div>

                      <div className="bg-primary/10 dark:bg-primary/15 p-3 rounded-lg">
                        <p className="font-semibold text-primary dark:text-foreground">DAIVE:</p>
                        <p className="text-primary dark:text-muted-foreground">
                          "Excellent! With a credit score around 720, you qualify for our good-credit tier with competitive rates. How much would you like to put down as a down payment?"
                        </p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="data-collected">
                  <AccordionTrigger>Information Collected</AccordionTrigger>
                  <AccordionContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left p-2 border">Data Point</th>
                            <th className="text-left p-2 border">Storage Location</th>
                            <th className="text-left p-2 border">Purpose</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="p-2 border">Payment Method</td>
                            <td className="p-2 border text-xs"><code>Daivesteps[12].slots.finance.preferred_method</code></td>
                            <td className="p-2 border">Finance/Lease/Cash</td>
                          </tr>
                          <tr>
                            <td className="p-2 border">Credit Score</td>
                            <td className="p-2 border text-xs"><code>Daivesteps[12].slots.finance.credit_score</code></td>
                            <td className="p-2 border">Determine tier & rate</td>
                          </tr>
                          <tr>
                            <td className="p-2 border">Down Payment</td>
                            <td className="p-2 border text-xs"><code>Daivesteps[12].slots.finance.down_payment</code></td>
                            <td className="p-2 border">Calculate monthly payment</td>
                          </tr>
                          <tr>
                            <td className="p-2 border">Lease Term</td>
                            <td className="p-2 border text-xs"><code>Daivesteps[12].slots.finance.lease_term</code></td>
                            <td className="p-2 border">For lease calculations</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Credit Applications Tab */}
        <TabsContent value="credit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Credit Application Process
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">10-Step Process:</h4>
                
                <div className="space-y-2">
                  {[
                    { step: 1, title: "Customer expresses interest", desc: "During DAIVE conversation (Step 12)" },
                    { step: 2, title: "DAIVE collects basic info", desc: "Credit score, down payment, preferred term" },
                    { step: 3, title: "Application created automatically", desc: "Database record created, linked to conversation" },
                    { step: 4, title: "Secure email sent", desc: "Customer receives unique application link" },
                    { step: 5, title: "Customer completes application", desc: "Personal info, SSN, DL, employment, income" },
                    { step: 6, title: "Application submitted", desc: "Data encrypted (AES-256), dealer notified" },
                    { step: 7, title: "Finance manager reviews", desc: "Review info, run credit check, verify income" },
                    { step: 8, title: "Lender submission (optional)", desc: "Submit to lenders, track responses" },
                    { step: 9, title: "Application approved/rejected", desc: "Update status, notify customer" },
                    { step: 10, title: "Deal sheet finalized", desc: "Generate PDF, send for e-signature" }
                  ].map((item) => (
                    <div key={item.step} className="flex gap-3 p-3 border rounded-lg">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">{item.step}</span>
                        </div>
                      </div>
                      <div>
                        <h5 className="font-semibold text-sm">{item.title}</h5>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 p-4 bg-primary/10 dark:bg-primary/15 rounded-lg border border-primary/20 dark:border-primary/30">
                <div className="flex gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <div>
                    <h4 className="font-semibold text-sm text-primary dark:text-foreground">Security Note</h4>
                    <p className="text-sm text-primary dark:text-muted-foreground">
                      All sensitive data (SSN, Driver's License) is encrypted using AES-256 encryption before storage. Only authorized finance managers can view this information.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deal Sheets Tab */}
        <TabsContent value="deals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Finance vs Lease Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3 border font-semibold">Factor</th>
                      <th className="text-left p-3 border font-semibold">Finance</th>
                      <th className="text-left p-3 border font-semibold">Lease</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-3 border font-medium">Ownership</td>
                      <td className="p-3 border">You own the vehicle</td>
                      <td className="p-3 border">Dealer owns, you rent</td>
                    </tr>
                    <tr>
                      <td className="p-3 border font-medium">Monthly Payment</td>
                      <td className="p-3 border">Higher</td>
                      <td className="p-3 border">Lower (30-40% less)</td>
                    </tr>
                    <tr>
                      <td className="p-3 border font-medium">Mileage Limits</td>
                      <td className="p-3 border">Unlimited</td>
                      <td className="p-3 border">10-15k miles/year</td>
                    </tr>
                    <tr>
                      <td className="p-3 border font-medium">Customization</td>
                      <td className="p-3 border">Fully allowed</td>
                      <td className="p-3 border">Not allowed</td>
                    </tr>
                    <tr>
                      <td className="p-3 border font-medium">End of Term</td>
                      <td className="p-3 border">You own it</td>
                      <td className="p-3 border">Return or buy out</td>
                    </tr>
                    <tr>
                      <td className="p-3 border font-medium">Equity</td>
                      <td className="p-3 border">Build equity</td>
                      <td className="p-3 border">No equity</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-6 space-y-4">
                <h4 className="font-semibold">Credit Tiers & Scoring</h4>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-green-50 dark:bg-green-950">
                    <div>
                      <Badge className="bg-green-600 mb-1">Tier 1</Badge>
                      <p className="text-sm font-medium">Excellent (750+)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">2.9% - 5.9% APR</p>
                      <p className="text-xs text-muted-foreground">Best rates</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg bg-primary/10 dark:bg-primary/15">
                    <div>
                      <Badge className="bg-primary mb-1">Tier 2</Badge>
                      <p className="text-sm font-medium">Good (700-749)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">6.0% - 8.5% APR</p>
                      <p className="text-xs text-muted-foreground">Competitive rates</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50 dark:bg-yellow-950">
                    <div>
                      <Badge className="bg-yellow-600 mb-1">Tier 3</Badge>
                      <p className="text-sm font-medium">Fair (650-699)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">8.6% - 11.9% APR</p>
                      <p className="text-xs text-muted-foreground">Moderate rates</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg bg-orange-50 dark:bg-orange-950">
                    <div>
                      <Badge className="bg-orange-600 mb-1">Tier 4</Badge>
                      <p className="text-sm font-medium">Poor (600-649)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">12% - 17% APR</p>
                      <p className="text-xs text-muted-foreground">Higher rates</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg bg-red-50 dark:bg-red-950">
                    <div>
                      <Badge className="bg-red-600 mb-1">Tier 5</Badge>
                      <p className="text-sm font-medium">Subprime (&lt;600)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">18% - 25% APR</p>
                      <p className="text-xs text-muted-foreground">Subprime lenders</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Payment Calculations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-2">Finance Payment Formula:</h4>
                <div className="bg-muted p-4 rounded-lg font-mono text-xs overflow-x-auto">
                  <p>Monthly Payment = P × (r × (1 + r)^n) / ((1 + r)^n - 1)</p>
                  <p className="mt-2 text-muted-foreground">
                    Where: P = Principal, r = Monthly rate (APR/12/100), n = Months
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2">Lease Payment Formula:</h4>
                <div className="bg-muted p-4 rounded-lg font-mono text-xs overflow-x-auto">
                  <p>Depreciation = (Cap Cost - Residual) / Term</p>
                  <p>Finance Charge = (Cap Cost + Residual) × Money Factor</p>
                  <p>Monthly Payment = Depreciation + Finance Charge</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Troubleshooting Tab */}
        <TabsContent value="troubleshoot" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                Common Issues & Solutions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="issue-1">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4" />
                      Customer Not Receiving Credit Application Email
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div>
                      <h5 className="font-semibold text-sm mb-2">Possible Causes:</h5>
                      <ul className="text-sm space-y-1 list-disc list-inside">
                        <li>Email in spam/junk folder</li>
                        <li>Incorrect email address</li>
                        <li>Email service not configured</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-semibold text-sm mb-2">Solutions:</h5>
                      <ol className="text-sm space-y-1 list-decimal list-inside">
                        <li>Check spam folder first</li>
                        <li>Verify email address in conversation history</li>
                        <li>Resend from: Finance → Credit Applications → Resend Email</li>
                        <li>Verify SMTP settings in Settings → Email Settings</li>
                      </ol>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="issue-2">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4" />
                      Payment Calculations Seem Incorrect
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div>
                      <h5 className="font-semibold text-sm mb-2">Solutions:</h5>
                      <ol className="text-sm space-y-1 list-decimal list-inside">
                        <li>Verify finance program exists for customer's credit tier</li>
                        <li>Check vehicle price is accurate in inventory</li>
                        <li>Ensure correct term length selected (36, 48, 60, 72 months)</li>
                        <li>Verify APR or money factor is correct in program settings</li>
                        <li>Regenerate deal sheet with updated information</li>
                      </ol>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="issue-3">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4" />
                      DAIVE Not Progressing to Step 12
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div>
                      <h5 className="font-semibold text-sm mb-2">Common Causes:</h5>
                      <ul className="text-sm space-y-1 list-disc list-inside">
                        <li>Previous steps (1-11) not completed</li>
                        <li>Purchase decision (Step 8) not confirmed</li>
                        <li>Journey tracking issue</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-semibold text-sm mb-2">Solutions:</h5>
                      <ol className="text-sm space-y-1 list-decimal list-inside">
                        <li>Check journey progress in DAIVE → Conversations</li>
                        <li>Ensure customer confirmed purchase intent</li>
                        <li>Type "I'd like to discuss financing" to trigger Step 12</li>
                        <li>Admin can manually advance to Step 12 if needed</li>
                      </ol>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="issue-4">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4" />
                      Finance Programs Not Showing
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div>
                      <h5 className="font-semibold text-sm mb-2">Solutions:</h5>
                      <ol className="text-sm space-y-1 list-decimal list-inside">
                        <li>Go to Finance → Programs and verify active programs exist</li>
                        <li>Check that credit tier ranges match customer's score</li>
                        <li>Verify program has correct term length (e.g., 60 months)</li>
                        <li>Ensure program is marked as "Active"</li>
                        <li>Create missing programs for all tiers if needed</li>
                      </ol>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="issue-5">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4" />
                      Deal Sheet PDF Not Generating
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div>
                      <h5 className="font-semibold text-sm mb-2">Solutions:</h5>
                      <ol className="text-sm space-y-1 list-decimal list-inside">
                        <li>Verify all required deal fields are filled</li>
                        <li>Check System Health in Settings for PDF service status</li>
                        <li>Ensure /uploads/deal-sheets/ directory exists with write permissions</li>
                        <li>Check system logs for PDF generation errors</li>
                        <li>Try "Force Regenerate PDF" option</li>
                      </ol>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Best Practices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm mb-2 text-green-700 dark:text-green-400">✅ DO:</h4>
                  <ul className="text-sm space-y-1">
                    <li>• Verify customer email before sending applications</li>
                    <li>• Explain credit tiers transparently</li>
                    <li>• Offer multiple financing options</li>
                    <li>• Follow up within 24 hours</li>
                    <li>• Keep programs updated with current rates</li>
                    <li>• Review deal sheets before sending</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-2 text-red-700 dark:text-red-400">❌ DON'T:</h4>
                  <ul className="text-sm space-y-1">
                    <li>• Promise rates without knowing credit score</li>
                    <li>• Skip steps in DAIVE journey</li>
                    <li>• Store unencrypted sensitive data</li>
                    <li>• Share exact credit scores with customers</li>
                    <li>• Let applications expire without follow-up</li>
                    <li>• Modify deal sheets after customer review</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Need more help? Contact your system administrator or refer to the full documentation.
            </p>
            <Button onClick={downloadGuide} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download Complete Guide (PDF)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};





