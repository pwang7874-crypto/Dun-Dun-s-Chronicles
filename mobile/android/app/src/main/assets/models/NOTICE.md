# Offline sticker model

U²-Net small (U2NETP), Xuebin Qin et al., Apache-2.0.
Source: https://github.com/xuebinqin/U-2-Net
Unmodified ONNX weights distributed by rembg:
https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx
Upstream MD5: 8e83ca70e441ab06c318d82300c84806
License included in U2NET-LICENSE.txt.

ONNX Runtime 1.24.3, Microsoft, MIT. License included in ONNXRUNTIME-LICENSE.txt.

The app performs inference locally. No user image is sent to a server.
Model output is only an alpha mask; original photo RGB is preserved.
