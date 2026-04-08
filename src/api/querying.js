function parsePagination(searchParams) {
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 100);
  return { page, limit };
}

function paginateItems(items, page, limit) {
  const total = items.length;
  const start = (page - 1) * limit;
  const pagedItems = items.slice(start, start + limit);

  return {
    items: pagedItems,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1)
    }
  };
}

function isWithinDateRange(value, createdFrom, createdTo) {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return false;
  }

  if (createdFrom) {
    const fromTs = new Date(createdFrom).getTime();
    if (!Number.isNaN(fromTs) && timestamp < fromTs) {
      return false;
    }
  }

  if (createdTo) {
    const toTs = new Date(createdTo).getTime();
    if (!Number.isNaN(toTs) && timestamp > toTs) {
      return false;
    }
  }

  return true;
}

function sortItems(items, searchParams, allowedFields) {
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const order = (searchParams.get('order') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

  if (!allowedFields.includes(sortBy)) {
    return items;
  }

  return [...items].sort((left, right) => {
    const leftValue = left[sortBy];
    const rightValue = right[sortBy];

    if (leftValue === rightValue) {
      return 0;
    }

    if (leftValue == null) {
      return order === 'asc' ? -1 : 1;
    }

    if (rightValue == null) {
      return order === 'asc' ? 1 : -1;
    }

    if (leftValue < rightValue) {
      return order === 'asc' ? -1 : 1;
    }

    return order === 'asc' ? 1 : -1;
  });
}

function filterShipments(items, searchParams) {
  const status = searchParams.get('status');
  const correlationId = searchParams.get('correlationId');
  const invoiceNumber = searchParams.get('invoiceNumber');
  const createdFrom = searchParams.get('createdFrom');
  const createdTo = searchParams.get('createdTo');

  return items.filter(item => {
    if (status && item.status !== status) return false;
    if (correlationId && (item.correlationId || item.input?.correlationId) !== correlationId) return false;

    if (invoiceNumber) {
      const candidate = item.input?.invoiceNumber || item.input?.invoiceData?.invoiceNumber || item.result?.invoiceNumber;
      if (candidate !== invoiceNumber) return false;
    }

    if ((createdFrom || createdTo) && !isWithinDateRange(item.createdAt, createdFrom, createdTo)) return false;
    return true;
  });
}

function filterQueueJobs(items, searchParams) {
  const status = searchParams.get('status');
  const correlationId = searchParams.get('correlationId');
  const type = searchParams.get('type');
  const createdFrom = searchParams.get('createdFrom');
  const createdTo = searchParams.get('createdTo');

  return items.filter(item => {
    if (status && item.status !== status) return false;
    if (type && item.type !== type) return false;
    if (correlationId && item.correlationId !== correlationId) return false;
    if ((createdFrom || createdTo) && !isWithinDateRange(item.createdAt, createdFrom, createdTo)) return false;
    return true;
  });
}

function filterDeadLetters(items, searchParams) {
  const correlationId = searchParams.get('correlationId');
  const shipmentRecordId = searchParams.get('shipmentRecordId');
  const createdFrom = searchParams.get('createdFrom');
  const createdTo = searchParams.get('createdTo');

  return items.filter(item => {
    if (correlationId && item.correlationId !== correlationId) return false;
    if (shipmentRecordId && item.shipmentRecordId !== shipmentRecordId) return false;
    if ((createdFrom || createdTo) && !isWithinDateRange(item.createdAt, createdFrom, createdTo)) return false;
    return true;
  });
}

module.exports = {
  filterDeadLetters,
  filterQueueJobs,
  filterShipments,
  paginateItems,
  parsePagination,
  sortItems
};
