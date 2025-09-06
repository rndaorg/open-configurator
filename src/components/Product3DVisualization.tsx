import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { Suspense, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Maximize2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as THREE from 'three';

interface Product3DVisualizationProps {
  product: any;
  selectedOptions: { [optionId: string]: string };
  className?: string;
}

// 3D Product Model Component
function ProductModel({ 
  product, 
  selectedOptions 
}: { 
  product: any; 
  selectedOptions: { [optionId: string]: string } 
}) {
  const modelConfig = useMemo(() => {
    // Get selected color
    const colorOption = product.config_options?.find((opt: any) => opt.option_type === 'color');
    const selectedColorValue = colorOption?.option_values?.find(
      (val: any) => val.id === selectedOptions[colorOption?.id]
    );
    
    // Get selected material
    const materialOption = product.config_options?.find((opt: any) => opt.option_type === 'material');
    const selectedMaterialValue = materialOption?.option_values?.find(
      (val: any) => val.id === selectedOptions[materialOption?.id]
    );

    return {
      color: selectedColorValue?.hex_color || '#8B5CF6',
      material: selectedMaterialValue?.name?.toLowerCase() || 'standard',
      size: getSelectedSize(product, selectedOptions)
    };
  }, [product, selectedOptions]);

  // Create different geometries based on product category
  const geometry = useMemo(() => {
    const category = product.categories?.name?.toLowerCase();
    
    switch (category) {
      case 'electronics':
        return new THREE.BoxGeometry(2, 0.1, 1.2); // Phone/tablet-like
      case 'furniture':
        return new THREE.BoxGeometry(1.5, 2, 0.8); // Chair/table-like
      case 'automotive':
        return new THREE.BoxGeometry(3, 1, 1.5); // Car-like
      default:
        return new THREE.BoxGeometry(1, 1, 1);
    }
  }, [product]);

  // Create material based on selection
  const material = useMemo(() => {
    const baseColor = new THREE.Color(modelConfig.color);
    
    switch (modelConfig.material) {
      case 'metal':
        return new THREE.MeshStandardMaterial({
          color: baseColor,
          metalness: 0.8,
          roughness: 0.2,
        });
      case 'leather':
        return new THREE.MeshStandardMaterial({
          color: baseColor,
          metalness: 0.0,
          roughness: 0.8,
        });
      case 'fabric':
        return new THREE.MeshStandardMaterial({
          color: baseColor,
          metalness: 0.0,
          roughness: 0.9,
        });
      default:
        return new THREE.MeshStandardMaterial({
          color: baseColor,
          metalness: 0.3,
          roughness: 0.4,
        });
    }
  }, [modelConfig]);

  const scale = modelConfig.size === 'large' ? 1.2 : modelConfig.size === 'small' ? 0.8 : 1;

  return (
    <mesh geometry={geometry} material={material} scale={[scale, scale, scale]}>
      <meshStandardMaterial {...material} />
    </mesh>
  );
}

function getSelectedSize(product: any, selectedOptions: { [optionId: string]: string }): string {
  const sizeOption = product.config_options?.find((opt: any) => opt.option_type === 'size');
  const selectedSizeValue = sizeOption?.option_values?.find(
    (val: any) => val.id === selectedOptions[sizeOption?.id]
  );
  return selectedSizeValue?.name?.toLowerCase() || 'medium';
}

// Loading component
function ModelLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">Loading 3D model...</p>
      </div>
    </div>
  );
}

export const Product3DVisualization = ({ 
  product, 
  selectedOptions, 
  className = "" 
}: Product3DVisualizationProps) => {
  const handleFullscreen = () => {
    // Implement fullscreen 3D view
    console.log('Opening fullscreen 3D view');
  };

  const handleReset = () => {
    // Reset camera position
    console.log('Resetting camera position');
  };

  return (
    <Card className={`glass-card overflow-hidden ${className}`}>
      <div className="relative h-96 bg-gradient-subtle">
        {/* Controls */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleReset}
            className="bg-background/80 backdrop-blur-sm"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleFullscreen}
            className="bg-background/80 backdrop-blur-sm"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>

        {/* 3D Model Badge */}
        <div className="absolute top-4 left-4 z-10">
          <Badge className="bg-gradient-primary text-primary-foreground">
            3D Preview
          </Badge>
        </div>

        {/* 3D Canvas */}
        <Canvas
          camera={{ position: [0, 0, 5], fov: 50 }}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={null}>
            {/* Lighting */}
            <ambientLight intensity={0.4} />
            <directionalLight 
              position={[10, 10, 5]} 
              intensity={1} 
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
            />
            <pointLight position={[-10, -10, -10]} intensity={0.3} />
            
            {/* Environment */}
            <Environment preset="studio" />
            
            {/* Product Model */}
            <ProductModel product={product} selectedOptions={selectedOptions} />
            
            {/* Contact Shadows */}
            <ContactShadows 
              position={[0, -1.4, 0]} 
              opacity={0.4} 
              scale={10} 
              blur={2.5} 
            />
            
            {/* Controls */}
            <OrbitControls
              enablePan={false}
              enableZoom={true}
              enableRotate={true}
              autoRotate={true}
              autoRotateSpeed={0.5}
              minDistance={3}
              maxDistance={8}
              maxPolarAngle={Math.PI / 2}
            />
          </Suspense>
        </Canvas>

        {/* Fallback for loading */}
        <Suspense fallback={<ModelLoader />}>
          <div />
        </Suspense>
      </div>

      {/* Configuration Info */}
      <div className="p-4 space-y-3">
        <h4 className="font-semibold text-sm">Current Configuration</h4>
        <div className="flex flex-wrap gap-2">
          {Object.entries(selectedOptions).map(([optionId, valueId]) => {
            const option = product.config_options?.find((opt: any) => opt.id === optionId);
            const value = option?.option_values?.find((val: any) => val.id === valueId);
            
            if (!option || !value) return null;
            
            return (
              <div key={optionId} className="flex items-center gap-2 text-xs">
                {value.hex_color && (
                  <div 
                    className="w-3 h-3 rounded-full border border-border"
                    style={{ backgroundColor: value.hex_color }}
                  />
                )}
                <span className="text-muted-foreground">{option.name}:</span>
                <span className="font-medium">{value.name}</span>
              </div>
            );
          })}
        </div>
        
        {Object.keys(selectedOptions).length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            Select options to see them reflected in the 3D model
          </p>
        )}
      </div>
    </Card>
  );
};