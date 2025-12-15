// src/components/ImageCropModal.jsx
import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../utils/cropImage';

export default function ImageCropModal({ 
  image, 
  onComplete, 
  onCancel,
  aspectRatio = null, // null = free crop, 1 = square, 16/9 = landscape
  title = 'Adjust Image'
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleApply = async () => {
    try {
          // Validate crop area
    if (!croppedAreaPixels || croppedAreaPixels.width === 0 || croppedAreaPixels.height === 0) {
      alert('Please adjust the crop area before applying');
      return;
    }
      setProcessing(true);
      const croppedImage = await getCroppedImg(image, croppedAreaPixels);
      onComplete(croppedImage);
    } catch (error) {
      console.error('Error cropping image:', error);
      alert('Failed to process image');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-mid-dark border border-white/20 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-title text-2xl text-light">{title}</h3>
              <p className="text-sm text-light/60 mt-1">
                Drag to reposition, scroll to zoom
              </p>
            </div>
            <button
              onClick={onCancel}
              disabled={processing}
              className="text-light/60 hover:text-light transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Crop Area */}
        <div className="relative flex-1 bg-black" style={{ minHeight: '400px' }}>
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            restrictPosition={false}
            cropShape="rect"
            showGrid={true} 
            cropSize={{ width: 400, height: 400 }} // ADD THIS - makes crop box bigger
            style={{
              containerStyle: {
                backgroundColor: '#000'
              },
              cropAreaStyle: {  // ADD THIS
                border: '2px solid #fff',
                color: 'rgba(255, 255, 255, 0.5)'
              }
            }}
          />
        </div>

        {/* Controls */}
        <div className="p-6 border-t border-white/10 space-y-4">
          {/* Zoom Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-light/80">Zoom</label>
              <span className="text-sm text-light/60">{Math.round(zoom * 100)}%</span>
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleApply}
              disabled={processing}
              className="flex-1 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition font-semibold disabled:opacity-50"
            >
              {processing ? '⏳ Processing...' : '✓ Apply & Upload'}
            </button>
            <button
              onClick={onCancel}
              disabled={processing}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-light rounded-lg transition"
            >
              Cancel
            </button>
          </div>

          {/* Info */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <p className="text-blue-300 text-sm">
              💡 <strong>Tips:</strong> Drag to reposition • Scroll/pinch to zoom • Image will be optimized for web
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
