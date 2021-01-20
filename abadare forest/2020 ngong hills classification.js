//Define the area of interest, Ngong hills Forest.
var AOIs = Ngong_AOI;

//Standard method for masking cloud pixels in the Sentinel-2 images
function maskS2clouds(image) {
  var qa = image.select('QA60');
  // Bits 10 and 11 are clouds and cirrus, respectively.
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;
  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
      .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  return image.updateMask(mask).divide(10000);
}
//Generate a cloud free Sentinel-2 image of the ngong hills forest area
var clipped = Sentinel_1C
              //Filter the dataset to the 2020 full year date range
              .filterDate('2020-01-01','2020-12-31')
              //Maintain the image metadata for the area of interest
              .filterBounds(AOIs)
              //Apply the cloud masking function to the remaining images in the filtered collection
              .map(maskS2clouds)
              //generate a single image from the filtered collection using median() reduction function
              .median()
              //and clip it to the area of interest
              .clip(AOIs);
              
//Center the map to the area of interest to a zoom level of 12
Map.centerObject(AOIs,12);

//Visualize the true color RGB generated image
Map.addLayer(clipped,{min: 0.0,max: 0.3,bands:['B4','B3','B2']},'Ngong_forest_2020' );

/*__________________________CLASSIFICATION SECTION______________________________
    In this section we will analyze the generated image into land cover classes
    The following are the classes with their restpective training data 
    numeric labels
    
      0: Natural Forest,
      1: Plantation Forest,
      2: Other Lands
      3: Crop Land
      4: Open grassland
      5: Wooded grassland
      6: Settlement*/
      
//The variable below is the name of the property in the training features 
//that stores the numeric labels for the classes:
var clasName2020 = 'LC2';

//The Sentinel-2 band names (bands) to be used as the inputs for classification
var bands = ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B11', 'B12'];

/* Below training features are picked using the geometry drawing tools in the map display
    shown below the code editor. They are drawn around the identified land cover on the source image,
    and labelled using the numeric labels shown above, then merged into the training features*/
var training_points = Natural_Forest_2.merge(Plantion_Forest_2).merge(Other_lands).merge(crop_land_2).merge(Open_Grassland_2).merge(Wooded_Grassland_2).merge(Settlement_2);
print('#2020_Classification', training_points);

//Use the trainig features to sample pixels from the source image to serve as
//training data.
var training2020 = clipped.select(bands).sampleRegions({
  collection: training_points,
  properties: ['LC2'],
  scale: 10
});

//Initialize a random forest classifier (smileRandomForest) and train it using
//the training data.
var trained2020 = ee.Classifier.smileRandomForest(10).train(training2020, clasName2020, bands);

//Use the trained classifier to classify the source image, which will outline the 
// highlighted land cover features.
var classified2020 = clipped.select(bands).classify(trained2020);

/*The  classified image generated contains a single classification band. Each pixel in the image
  has a value for that band, corresponding to the land cover classification label within which
  it falls in the image.
  
  Since we have seven land cover classes, the pixel values for the band range between zero and six
  When visualizing the image below, each group of pixels; region within the image with a certain value
  is assigned its own color.*/
Map.addLayer(classified2020,
{min: 0, max: 6, palette: ['006400','32CD32','C0C0C0','800000','F0E68C', '808000','000000']},'Classification2016_new');

var legend = ui.Panel({
  style: {
    position: 'bottom-right',
    padding: '6px 15px'
  }
});

var legendTitle = ui.Label({
  value: 'Legend',
  style: {
    fontWeight: 'bold',
    fontSize: '18px',
    margin: '0 0 4px 0',
    padding: '0'
    }
});

// Add the title to the panel
legend.add(legendTitle);

var palette =['006400','32CD32','C0C0C0','800000','F0E68C', '808000','000000'];
 
// name of the legend
var names = ['Natural Forest','Plantation','Other lands','Cropland','Open Grassland', 'Wooded grassland', 'Settlement'];
 
 var makeRow = function(color, name){
      // Create the label that is actually the colored box.
      var colorBox = ui.Label({
        style: {
          backgroundColor:color,
          // Use padding to give the box height and width.
          padding: '8px',
          margin: '0 0 4px 0'
        }
      });
      // Create the label filled with the description text.
      var description = ui.Label({
        value: name,
        style: {margin: '0 0 4px 6px'}
      });
      // return the panel
      return ui.Panel({
        widgets: [colorBox, description],
        layout: ui.Panel.Layout.Flow('horizontal')
      });
};
 
// Add color and and names
for (var i = 0; i < 7; i++){
  legend.add(makeRow(palette[i], names[i]));
}
// add legend to map (alternatively you can also print the legend to the console)
Map.add(legend);
Export.image.toDrive({
image: classified2020,
description:'Classification2020_new',
scale: 20,
//maxPixels: 1e10,
region: AOIs,
});
var areaImage2020 = ee.Image.pixelArea().addBands(classified2020).divide(10000);
 
var areas2020 = areaImage2020.reduceRegion({
      reducer: ee.Reducer.sum().group({
      groupField: 1,
      groupName: 'clasName2020',
    }),
    geometry: AOIs,
    scale: 10,
    maxPixels: 1e10
    }); 
 
print(areas2020, 'Hectares');


// Validation of the classified image

//var validation_valNames = sample.filter(ee.Filter.gte('random', split));

var val_Points = Acc_points.merge(vNat).merge(vPlantation).merge(vOthers).merge(vCrop).merge(vOPEN).merge(vWOOD).merge(Vsettle);
var validation = classified2020.sampleRegions({
  collection: val_Points,
  properties: ['LC2'],
  scale: 10
});
print('Validation', validation);




// compare the landcover of your validation data against the classification results

var testAccuracy = validation.errorMatrix('classification', 'LC2');

//  print the error matrix to the console

print('Validation confusion matrix:', testAccuracy);

//print overall accuracy to the console

print('Validation overall accuracy:', testAccuracy.accuracy().multiply(100));

print('Kappa Value:', testAccuracy.kappa());

print('Producers Accuracy:', testAccuracy.producersAccuracy().multiply(100));

print('Consumers Accuracy:', testAccuracy.consumersAccuracy().multiply(100));