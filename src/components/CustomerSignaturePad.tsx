/**
 * Customer Signature Pad Component
 * Electronic signature capture for credit applications
 */

import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Check, X, Pen } from 'lucide-react';

interface CustomerSignaturePadProps {
  onSave: (signatureData: string) => void;
  signatureData?: string | null;
  required?: boolean;
}

export const CustomerSignaturePad: React.FC<CustomerSignaturePadProps> = ({ 
  onSave, 
  signatureData,
  required = false 
}) => {
  const sigPadRef = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(!signatureData);
  const [isSaved, setIsSaved] = useState(!!signatureData);

  const clearSignature = () => {
    sigPadRef.current?.clear();
    setIsEmpty(true);
    setIsSaved(false);
  };

  const saveSignature = () => {
    if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
      const signatureDataUrl = sigPadRef.current.toDataURL('image/png');
      onSave(signatureDataUrl);
      setIsSaved(true);
      setIsEmpty(false);
    }
  };

  const handleEnd = () => {
    if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
      setIsEmpty(false);
    }
  };

  return (
    <Card className="p-6 bg-white border-2 border-gray-200">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold flex items-center gap-2">
            <Pen className="h-5 w-5" />
            Electronic Signature {required && <span className="text-red-500">*</span>}
          </Label>
          {isSaved && (
            <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
              <Check className="h-4 w-4" />
              Saved
            </div>
          )}
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 relative overflow-hidden">
          {signatureData && isSaved ? (
            // Display saved signature
            <div className="relative">
              <img 
                src={signatureData} 
                alt="Your signature" 
                className="w-full h-[200px] object-contain bg-white"
              />
              <div className="absolute top-2 right-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsSaved(false);
                    clearSignature();
                  }}
                  className="bg-white"
                >
                  <X className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </div>
            </div>
          ) : (
            // Signature canvas
            <SignatureCanvas
              ref={sigPadRef}
              canvasProps={{
                className: 'w-full h-[200px] cursor-crosshair',
                style: { backgroundColor: 'white' }
              }}
              onEnd={handleEnd}
              backgroundColor="white"
              penColor="black"
            />
          )}
        </div>

        {!isSaved && (
          <div className="flex gap-2 justify-between items-center">
            <p className="text-xs text-gray-500">
              Sign above using your mouse, trackpad, or touchscreen
            </p>
            <div className="flex gap-2">
              <Button 
                type="button"
                variant="outline" 
                onClick={clearSignature}
                disabled={isEmpty}
                size="sm"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
              <Button 
                type="button"
                onClick={saveSignature}
                disabled={isEmpty}
                size="sm"
              >
                <Check className="h-4 w-4 mr-1" />
                Save Signature
              </Button>
            </div>
          </div>
        )}

        <div className="bg-primary/10 border border-primary/20 rounded-md p-3">
          <p className="text-xs text-primary">
            <strong>Legal Notice:</strong> By signing above, you certify that all information 
            provided is accurate and authorize the lender to perform credit checks and 
            background verification.
          </p>
        </div>
      </div>
    </Card>
  );
};

export default CustomerSignaturePad;

