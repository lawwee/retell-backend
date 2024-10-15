// __tests__/searchForUser.test.js
import request from 'supertest';
import app from '../src/index'; // Assuming app is your Express app
import { find } from '../src/contacts/contact_model'; // Mock this

jest.mock("../src/contacts/contact_model"); // Mock contactModel

describe('POST /search', () => {
  let validPayload;

  beforeEach(() => {
    validPayload = {
      searchTerm: 'john.doe@example.com',
      agentId: '12345',
      startDate: '2024-10-01',
      endDate: '2024-10-10',
      statusOption: 'call-connected',
      sentimentOption: 'interested',
      tag: 'VIP',
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 if agentId is missing', async () => {
    const res = await request(app)
      .post('/search')
      .send({ ...validPayload, agentId: undefined });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Search term or agent Ids is required');
  });

  it('should call contactModel.find with correct query for email search', async () => {
    find.mockResolvedValueOnce([{ email: 'john.doe@example.com' }]);

    const res = await request(app)
      .post('/search')
      .send(validPayload);

    expect(res.statusCode).toBe(200);
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: '12345',
        isDeleted: false,
        $or: [{ email: { $regex: 'john.doe@example.com', $options: 'i' } }],
      })
    );
    expect(res.body).toEqual([{ email: 'john.doe@example.com' }]);
  });

  it('should call contactModel.find with correct date range when both startDate and endDate are provided', async () => {
    find.mockResolvedValueOnce([{ email: 'jane.doe@example.com' }]);

    const res = await request(app)
      .post('/search')
      .send(validPayload);

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        datesCalled: { $gte: '2024-10-01', $lte: '2024-10-10' },
      })
    );
    expect(res.body).toEqual([{ email: 'jane.doe@example.com' }]);
  });

  it('should filter by tag when provided', async () => {
    find.mockResolvedValueOnce([{ tag: 'VIP' }]);

    const res = await request(app)
      .post('/search')
      .send(validPayload);

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        tag: 'vip', // toLowerCase was applied
      })
    );
    expect(res.body).toEqual([{ tag: 'VIP' }]);
  });

  it('should return empty results when no statusOption matches', async () => {
    find.mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/search')
      .send({ ...validPayload, statusOption: 'invalid-status' });

    expect(find).not.toHaveBeenCalled();
    expect(res.body).toEqual([]);
  });

  it('should return 500 if there is a server error', async () => {
    find.mockRejectedValueOnce(new Error('Database error'));

    const res = await request(app)
      .post('/search')
      .send(validPayload);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });
});
