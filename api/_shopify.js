const shopifyApiVersion = process.env.SHOPIFY_API_VERSION || '2026-07';

function getShopifyConfig() {
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!shopDomain || !token) {
    return null;
  }

  return {
    shopDomain: shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    token,
  };
}

async function shopifyGraphql(query, variables = {}) {
  const config = getShopifyConfig();

  if (!config) {
    return null;
  }

  const response = await fetch(`https://${config.shopDomain}/admin/api/${shopifyApiVersion}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': config.token,
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = await response.json();

  if (!response.ok || payload.errors?.length) {
    throw new Error(payload.errors?.[0]?.message || `Shopify returned ${response.status}`);
  }

  return payload.data;
}

function splitCustomerName(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return { firstName: parts[0] || '', lastName: '' };
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts.at(-1),
  };
}

function getCustomerNameParts(customer = {}) {
  if (customer.firstName || customer.lastName) {
    return {
      firstName: String(customer.firstName || '').trim(),
      lastName: String(customer.lastName || '').trim(),
    };
  }

  return splitCustomerName(customer.name);
}

function getCustomerMetafields(quote) {
  const value = {
    quoteId: quote.quoteId,
    planType: quote.planType || quote.internalType || 'closet plan',
    estimatedPrice: quote.estimatedPrice || 0,
    planUrl: quote.planUrl || '',
    submittedAt: quote.submittedAt,
  };

  return [
    {
      namespace: 'custom',
      key: 'latest_closet_plan_url',
      type: 'url',
      value: quote.planUrl || '',
    },
    {
      namespace: 'custom',
      key: 'latest_closet_plan_type',
      type: 'single_line_text_field',
      value: quote.planType || quote.internalType || 'closet plan',
    },
    {
      namespace: 'custom',
      key: 'latest_closet_quote_id',
      type: 'single_line_text_field',
      value: quote.quoteId || '',
    },
    {
      namespace: 'custom',
      key: 'latest_closet_plan',
      type: 'json',
      value: JSON.stringify(value),
    },
  ].filter((metafield) => metafield.value);
}

async function findCustomerByEmail(email) {
  const data = await shopifyGraphql(
    `query findCustomer($query: String!) {
      customers(first: 1, query: $query) {
        nodes {
          id
          email
        }
      }
    }`,
    { query: `email:${email}` },
  );

  return data?.customers?.nodes?.[0] || null;
}

function getUserErrorMessage(payload, key) {
  const errors = payload?.[key]?.userErrors || [];
  return errors.length ? errors.map((error) => error.message).join('; ') : '';
}

async function createCustomer(quote) {
  const { firstName, lastName } = getCustomerNameParts(quote.customer);
  const data = await shopifyGraphql(
    `mutation createCustomer($input: CustomerInput!) {
      customerCreate(input: $input) {
        customer {
          id
          email
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      input: {
        email: quote.customer.email,
        firstName,
        lastName,
        tags: ['closet-planner', 'closet-plan-subscriber'],
        emailMarketingConsent: {
          marketingState: 'SUBSCRIBED',
          marketingOptInLevel: 'SINGLE_OPT_IN',
          consentUpdatedAt: quote.submittedAt || new Date().toISOString(),
        },
        metafields: getCustomerMetafields(quote),
      },
    },
  );

  const errorMessage = getUserErrorMessage(data, 'customerCreate');

  if (errorMessage) {
    throw new Error(errorMessage);
  }

  return data.customerCreate.customer;
}

async function updateCustomer(customerId, quote) {
  const { firstName, lastName } = getCustomerNameParts(quote.customer);
  const data = await shopifyGraphql(
    `mutation updateCustomer($input: CustomerInput!) {
      customerUpdate(input: $input) {
        customer {
          id
          email
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      input: {
        id: customerId,
        firstName,
        lastName,
      },
    },
  );

  const errorMessage = getUserErrorMessage(data, 'customerUpdate');

  if (errorMessage) {
    throw new Error(errorMessage);
  }

  return data.customerUpdate.customer;
}

async function addCustomerTags(customerId) {
  const data = await shopifyGraphql(
    `mutation addTags($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) {
        userErrors {
          field
          message
        }
      }
    }`,
    { id: customerId, tags: ['closet-planner', 'closet-plan-subscriber'] },
  );
  const errorMessage = getUserErrorMessage(data, 'tagsAdd');

  if (errorMessage) {
    throw new Error(errorMessage);
  }
}

async function updateEmailMarketingConsent(customerId, quote) {
  const data = await shopifyGraphql(
    `mutation updateConsent($input: CustomerEmailMarketingConsentUpdateInput!) {
      customerEmailMarketingConsentUpdate(input: $input) {
        customer {
          id
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      input: {
        customerId,
        emailMarketingConsent: {
          marketingState: 'SUBSCRIBED',
          marketingOptInLevel: 'SINGLE_OPT_IN',
          consentUpdatedAt: quote.submittedAt || new Date().toISOString(),
        },
      },
    },
  );
  const errorMessage = getUserErrorMessage(data, 'customerEmailMarketingConsentUpdate');

  if (errorMessage) {
    throw new Error(errorMessage);
  }
}

async function setCustomerPlanMetafields(customerId, quote) {
  const data = await shopifyGraphql(
    `mutation setMetafields($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          key
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      metafields: getCustomerMetafields(quote).map((metafield) => ({
        ...metafield,
        ownerId: customerId,
      })),
    },
  );
  const errorMessage = getUserErrorMessage(data, 'metafieldsSet');

  if (errorMessage) {
    throw new Error(errorMessage);
  }
}

export async function upsertShopifyCustomerPlan(quote) {
  if (!getShopifyConfig()) {
    return { configured: false };
  }

  const email = String(quote.customer?.email || '').trim().toLowerCase();

  if (!email) {
    return { configured: true, skipped: true, reason: 'Missing customer email' };
  }

  let customer = await findCustomerByEmail(email);
  let created = false;

  if (!customer) {
    try {
      customer = await createCustomer({
        ...quote,
        customer: {
          ...quote.customer,
          email,
        },
      });
      created = true;
    } catch (error) {
      if (!/already|taken|exists/i.test(error.message)) {
        throw error;
      }

      customer = await findCustomerByEmail(email);
    }
  }

  if (!customer?.id) {
    throw new Error('Shopify customer could not be created or found');
  }

  if (!created) {
    await updateCustomer(customer.id, quote);
    await addCustomerTags(customer.id);
    await updateEmailMarketingConsent(customer.id, quote);
    await setCustomerPlanMetafields(customer.id, quote);
  }

  return {
    configured: true,
    customerId: customer.id,
    customerEmail: customer.email || email,
    created,
    planUrl: quote.planUrl || '',
  };
}
