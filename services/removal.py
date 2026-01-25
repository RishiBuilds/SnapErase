import logging
from rembg import remove
from PIL import Image
import io

logger = logging.getLogger(__name__)

def remove_background(image_bytes: bytes) -> bytes:
    """
    Removes the background from an image.
    
    Args:
        image_bytes: The raw bytes of the input image.
        
    Returns:
        bytes: The raw bytes of the processed image in PNG format.
        
    Raises:
        Exception: If background removal fails.
    """
    try:
        # Load image from bytes
        input_image = Image.open(io.BytesIO(image_bytes))
        
        # Ensure image is in RGB or RGBA mode
        if input_image.mode not in ("RGB", "RGBA"):
            input_image = input_image.convert("RGBA")
            
        # Process image using rembg
        processed = remove(input_image)
        
        # rembg can return several types. We need a PIL Image to save it.
        if isinstance(processed, Image.Image):
            output_image = processed
        elif isinstance(processed, (bytes, bytearray)):
            # If it returns bytes/bytearray, it's likely an encoded image or mask
            output_image = Image.open(io.BytesIO(processed))
        else:
            # For ndarray or memoryview, we use fromarray. 
            # We use typing.Any or a cast if needed, but here we'll use a type ignore 
            # for the specific Pylance issue with broad unions.
            output_image = Image.fromarray(processed)  # type: ignore
        
        # Save processed image to bytes
        output_io = io.BytesIO()
        output_image.save(output_io, format="PNG")
        output_bytes = output_io.getvalue()
        
        return output_bytes
    except Exception as e:
        logger.error(f"Error during background removal: {str(e)}", exc_info=True)
        raise Exception(f"Failed to process image: {str(e)}")
