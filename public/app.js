// DOM Elements
const addProductForm = document.getElementById('add-product-form');
const productNameInput = document.getElementById('product-name');
const productQuantityInput = document.getElementById('product-quantity');
const phoneNumberInput = document.getElementById('phone-number');
const addProductButton = document.getElementById('add-product-button');

document.addEventListener('DOMContentLoaded', () => {
  const scanButton = document.getElementById('scan-button');
  const resultContainer = document.getElementById('result-container');

  if (!scanButton) {
      console.error('Scan button not found!');
      return;
  }

  // Event listener for the scan button
  scanButton.addEventListener('click', () => {
      console.log('Scan button clicked. Initializing Quagga...');
      
      // Initialize Quagga for live barcode scanning
      Quagga.init({
          inputStream: {
              name: 'Live',
              type: 'LiveStream',
              target: document.getElementById('scanner-container'), // The container element for live stream
          },
          decoder: {
              readers: ['code_128_reader', 'ean_reader', 'ean_8_reader', 'upc_reader'], // List the barcode readers you need
          },
      }, (err) => {
          if (err) {
              console.error('Error initializing Quagga:', err);
              resultContainer.textContent = 'Error initializing barcode scanner. Please try again.';
              return;
          }
          console.log('Quagga initialized successfully.');
          Quagga.start(); // Start live barcode scanning
      });

      // Event listener for detected barcodes
      Quagga.onDetected((result) => {
          const barcode = result.codeResult?.code; // Extract the barcode value

          if (barcode) {
              console.log(`Detected barcode: ${barcode}`);
              resultContainer.textContent = `Detected barcode: ${barcode}`;
              Quagga.stop(); // Stop scanning once a barcode is detected
              updateInventory(barcode); // Call function to update inventory
          } else {
              console.log('Barcode detection failed. No codeResult found.');
              resultContainer.textContent = 'Failed to detect a barcode. Please try again.';
          }
      });
  });
});

async function updateInventory(barcode) {
  console.log(`Updating inventory for barcode: ${barcode}`);

  try {
    const response = await fetch(`/items/barcode/${barcode}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 1 }),
    });

    if (response.status === 404) {
      console.log('Product not found. Showing add product form.');
      showAddProductForm(barcode);
    } else if (!response.ok) {
      const errorData = await response.json();
      console.error('Error from server:', errorData.message);
      alert(`Error: ${errorData.message}`);
    } else {
      const data = await response.json();
      console.log('Inventory updated successfully:', data);
      alert(`Inventory updated for barcode: ${barcode}`);
    }
  } catch (error) {
    console.error('Fetch error:', error);
    alert('Network error or server is not responding.');
  }
}

// Show the add product form
function showAddProductForm(barcode) {
  if (!addProductForm) {
    console.error('Add product form not found!');
    alert('Add product form is missing from the page.');
    return;
  }
  
  addProductForm.style.display = 'block';
  addProductButton.onclick = () => addNewProduct(barcode);
}

// Function to add a new product
async function addNewProduct(barcode) {
  const name = productNameInput.value.trim();
  const quantity = parseInt(productQuantityInput.value, 10) || 1;
  const phoneNumber = phoneNumberInput.value.trim();

  if (!name) {
    alert('Product name is required.');
    return;
  }

  console.log(`Adding new product: ${name}, Barcode: ${barcode}`);

  try {
    const response = await fetch('/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcode: barcode,
        name: name,
        quantity: quantity,
        phone_number: phoneNumber,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error adding new product:', errorData.message);
      alert(`Error adding product: ${errorData.message}`);
      return;
    }

    const data = await response.json();
    console.log('Product added successfully:', data);
    alert(`Product "${name}" added successfully.`);
    addProductForm.style.display = 'none';
    productNameInput.value = '';
    productQuantityInput.value = '1';
    phoneNumberInput.value = '';
  } catch (error) {
    console.error('Fetch error:', error);
    alert('Failed to add the new product. Please try again.');
  }
}
