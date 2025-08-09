import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, X, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { vehiclesAPI } from "@/lib/api";

interface ImageUploadProps {
  vehicleId?: string;
  existingImages?: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
}

export const ImageUpload = ({ 
  vehicleId, 
  existingImages = [], 
  onImagesChange, 
  maxImages = 10 
}: ImageUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<string[]>(existingImages);
  const { toast } = useToast();

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      if (!vehicleId) {
        // If no vehicle ID, create a temporary URL for preview
        return URL.createObjectURL(file);
      }

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('images', file);

      // Upload to server
      const response = await vehiclesAPI.uploadImages(vehicleId, formData);
      
      if (response.success && response.images && response.images.length > 0) {
        // Return the first uploaded image URL
        return response.images[0];
      } else {
        throw new Error('Upload failed');
      }
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({
        title: "Upload Error",
        description: error.message || "Failed to upload image",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (images.length + files.length > maxImages) {
      toast({
        title: "Too many images",
        description: `Maximum ${maxImages} images allowed`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    const newImageUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not an image file`,
          variant: "destructive",
        });
        continue;
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} is larger than 5MB`,
          variant: "destructive",
        });
        continue;
      }

      const imageUrl = await uploadImage(file);
      if (imageUrl) {
        newImageUrls.push(imageUrl);
      }
    }

    const updatedImages = [...images, ...newImageUrls];
    setImages(updatedImages);
    onImagesChange(updatedImages);
    setUploading(false);

    if (newImageUrls.length > 0) {
      toast({
        title: "Images uploaded",
        description: `${newImageUrls.length} image(s) uploaded successfully`,
      });
    }

    // Reset file input
    event.target.value = '';
  };

  const removeImage = async (imageUrl: string, index: number) => {
    try {
      if (vehicleId) {
        // Delete from server
        await vehiclesAPI.deleteImage(vehicleId, index);
      }
      
      // Remove from state
      const updatedImages = images.filter((_, i) => i !== index);
      setImages(updatedImages);
      onImagesChange(updatedImages);

      toast({
        title: "Image removed",
        description: "Image deleted successfully",
      });
    } catch (error: any) {
      console.error('Error removing image:', error);
      // Still remove from state even if deletion fails
      const updatedImages = images.filter((_, i) => i !== index);
      setImages(updatedImages);
      onImagesChange(updatedImages);
      
      toast({
        title: "Warning",
        description: "Image removed from preview but may not have been deleted from server",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Vehicle Images</label>
        <Badge variant="outline" className="text-xs">
          {images.length}/{maxImages}
        </Badge>
      </div>

      {/* Upload Area */}
      <div className="relative">
        <Input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          disabled={uploading || images.length >= maxImages}
          className="hidden"
          id="image-upload"
        />
        <label
          htmlFor="image-upload"
          className={`
            flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer
            transition-colors duration-200
            ${uploading || images.length >= maxImages 
              ? 'border-muted bg-muted cursor-not-allowed' 
              : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50'}
          `}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                <p className="text-sm text-muted-foreground">Uploading images...</p>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {images.length >= maxImages 
                    ? `Maximum ${maxImages} images reached`
                    : "Click to upload images or drag and drop"
                  }
                </p>
                <p className="text-xs text-muted-foreground">PNG, JPG, JPEG up to 5MB</p>
              </>
            )}
          </div>
        </label>
      </div>

      {/* Image Preview Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((imageUrl, index) => (
            <Card key={index} className="relative overflow-hidden">
              <CardContent className="p-0">
                <div className="relative group">
                  <img
                    src={imageUrl}
                    alt={`Vehicle image ${index + 1}`}
                    className="w-full h-32 object-cover"
                    onError={(e) => {
                      // Fallback for broken images
                      const target = e.target as HTMLImageElement;
                      target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f3f4f6"/><text x="100" y="100" text-anchor="middle" dy=".3em" fill="%23374151">Image Error</text></svg>';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removeImage(imageUrl, index)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {index === 0 && (
                    <Badge className="absolute top-2 left-2 text-xs">
                      Primary
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {images.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <ImageIcon className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground text-center">
              No images uploaded yet. Add some photos to showcase the vehicle.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};