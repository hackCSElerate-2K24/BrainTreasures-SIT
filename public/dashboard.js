//inventory.js
document.addEventListener('DOMContentLoaded', () => {
    const addItemForm = document.getElementById('add-item-form');
    const inventoryList = document.getElementById('inventory-list');
    const exportCsvButton = document.getElementById('export-csv');
    const importCsvButton = document.getElementById('import-csv');
  
    // Fetch and display inventory data
    async function fetchInventory() {
      try {
        const response = await fetch('/items');
        const items = await response.json();
        displayInventory(items);
      } catch (error) {
        console.error('Error fetching inventory:', error);
      }
    }
  
    // Display inventory data in the table
    function displayInventory(items) {
      inventoryList.innerHTML = ''; // Clear the table
      items.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td class="py-2 px-4">${item.barcode}</td>
          <td class="py-2 px-4">${item.name}</td>
          <td class="py-2 px-4">${item.quantity}</td>
          <td class="py-2 px-4">${item.quantity < 5 ? '⚠ Low Stock' : ''}</td>
        `;
        inventoryList.appendChild(row);
      });
    }
  
    // Handle form submission to add a new item
    addItemForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const barcode = document.getElementById('barcode').value;
      const name = document.getElementById('name').value;
      const quantity = parseInt(document.getElementById('quantity').value);
  
      const newItem = { barcode, name, quantity };
  
      try {
        const response = await fetch('/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newItem),
        });
  
        if (response.ok) {
          alert('Item added successfully');
          fetchInventory();
          addItemForm.reset();
        } else {
          alert('Failed to add item');
        }
      } catch (error) {
        console.error('Error adding item:', error);
      }
    });
  
    // Export inventory to CSV
    exportCsvButton.addEventListener('click', async () => {
      try {
        const response = await fetch('/items');
        const items = await response.json();
        let csvContent = 'Barcode,Name,Quantity\n';
        items.forEach(item => {
          csvContent += ${item.barcode},${item.name},${item.quantity}\n;
        });
  
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'inventory.csv';
        link.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error exporting CSV:', error);
      }
    });
  
    // Import CSV file
    importCsvButton.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv';
      input.onchange = async (event) => {
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onload = async (e) => {
          const csvData = e.target.result;
          const lines = csvData.split('\n').slice(1);
          for (const line of lines) {
            const [barcode, name, quantity] = line.split(',');
            if (barcode && name && quantity) {
              await fetch('/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ barcode, name, quantity: parseInt(quantity) }),
              });
            }
          }
          fetchInventory();
        };
        reader.readAsText(file);
      };
      input.click();
    });
  
    // Initial fetch of inventory data
    fetchInventory();
  });