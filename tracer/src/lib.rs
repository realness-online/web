use wasm_bindgen::prelude::*;
use web_sys::{ImageData};
use visioncortex::{
    Color, ColorImage,
    color_clusters::{Clusters, Runner, RunnerConfig, ClusteringMode},
    PathSimplifier,
    color_clusters::ClusterConfig
};

pub fn add(left: u64, right: u64) -> u64 {
    left + right
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }
}

#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub struct TraceOptions {
    pub color_count: u32,
    pub min_color_count: u32,
    pub max_color_count: u32,
    pub turd_size: u32,
    pub corner_threshold: f64,
    pub color_precision: u32,
    pub path_precision: u32,
    pub force_color_count: bool,
    pub hierarchical: bool,
    pub keep_details: bool,
}

#[wasm_bindgen]
impl TraceOptions {
    #[wasm_bindgen(constructor)]
    pub fn new() -> TraceOptions {
        TraceOptions {
            color_count: 32,
            min_color_count: 32,
            max_color_count: 32,
            turd_size: 20,
            corner_threshold: 60.0,
            color_precision: 8,
            path_precision: 8,
            force_color_count: true,
            hierarchical: true,
            keep_details: true,
        }
    }
}

#[wasm_bindgen]
pub fn process_image(image_data: ImageData, options: TraceOptions) -> Result<JsValue, JsValue> {
    let width = image_data.width() as usize;
    let height = image_data.height() as usize;
    let data = image_data.data();

    let mut color_image = ColorImage::new(width, height);
    for y in 0..height {
        for x in 0..width {
            let i = (y * width + x) * 4;
            let color = Color::new(
                data[i],     // r
                data[i + 1], // g
                data[i + 2], // b
                data[i + 3], // a
            );
            color_image.set(x, y, color);
        }
    }

    // Configure for exact 32 colors
    let cluster_config = ClusterConfig {
        min_clusters: 32,
        max_clusters: 32,
        min_size: options.turd_size as usize,
        color_precision: options.color_precision as usize,
        mode: ClusteringMode::KMeans, // Use KMeans for better color distribution
        ..ClusterConfig::default()
    };

    let mut runner = Runner::new(
        &color_image,
        RunnerConfig {
            cluster_config,
            force_cluster_count: true, // Force exact cluster count
            ..RunnerConfig::default()
        }
    );

    let clusters = runner.run();

    // Ensure we got exactly 32 clusters
    assert_eq!(clusters.len(), 32, "Failed to generate exactly 32 color segments");

    // Process clusters into paths
    let mut paths = Vec::new();
    for cluster in clusters.iter() {
        let color = cluster.color();
        let mut simplifier = PathSimplifier::new(
            cluster.points(),
            options.corner_threshold,
            45.0, // splice threshold
            options.path_precision as usize,
        );

        if let Some(path) = simplifier.build() {
            paths.push(serde_wasm_bindgen::to_value(&(path, color))?);
        }
    }

    // Create result object
    let result = js_sys::Object::new();

    js_sys::Reflect::set(
        &result,
        &"paths".into(),
        &serde_wasm_bindgen::to_value(&paths)?
    )?;

    js_sys::Reflect::set(
        &result,
        &"width".into(),
        &JsValue::from_f64(width as f64)
    )?;

    js_sys::Reflect::set(
        &result,
        &"height".into(),
        &JsValue::from_f64(height as f64)
    )?;

    Ok(result.into())
}
